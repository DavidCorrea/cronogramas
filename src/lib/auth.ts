import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts, members } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
declare module "next-auth" {
  interface User {
    isAdmin?: boolean;
    canCreateGroups?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin: boolean;
      canCreateGroups: boolean;
      emailVerified?: Date | null;
    };
    /** Set when an admin is impersonating another user; real admin's id */
    realUserId?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  events: {
    async createUser({ user }) {
      // Auto-link: when a new user signs in for the first time,
      // link any unlinked members whose email matches.
      if (user.id && user.email) {
        const email = user.email.toLowerCase().trim();
        await db
          .update(members)
          .set({ userId: user.id })
          .where(
            and(
              eq(members.email, email),
              isNull(members.userId)
            )
          );
      }
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }
      // Impersonation: only admins can set/clear; payload comes from client update()
      if (trigger === "update" && session && typeof session === "object" && "impersonatedUserId" in session) {
        const next = (session as { impersonatedUserId?: string | null }).impersonatedUserId;
        if (next === null || next === undefined) {
          delete token.impersonatedUserId;
          delete token.realId;
        } else if (typeof next === "string" && token.isAdmin) {
          token.impersonatedUserId = next;
          token.realId = token.id as string;
        }
      }
      // Effective user id for fetching flags: real user when impersonating
      const effectiveId = (token.realId as string | undefined) ?? (token.id as string | undefined);
      if (effectiveId && (user || trigger === "update")) {
        const dbUser = (await db
          .select({ isAdmin: users.isAdmin, canCreateGroups: users.canCreateGroups })
          .from(users)
          .where(eq(users.id, effectiveId)))[0];
        if (dbUser) {
          token.isAdmin = dbUser.isAdmin;
          token.canCreateGroups = dbUser.canCreateGroups;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const impersonatedId = token.impersonatedUserId as string | undefined;
      const realId = token.realId as string | undefined;
      if (impersonatedId && realId) {
        const target = (await db
          .select({ id: users.id, name: users.name, email: users.email, image: users.image })
          .from(users)
          .where(eq(users.id, impersonatedId))
          .limit(1))[0];
        if (target) {
          session.user = {
            id: target.id,
            name: target.name,
            email: target.email,
            image: target.image,
            isAdmin: false,
            canCreateGroups: false,
            emailVerified: null,
          };
          session.realUserId = realId;
        } else {
          // Impersonated user was deleted: show real user and clear impersonation
          const realUser = (await db
            .select({ id: users.id, name: users.name, email: users.email, image: users.image, isAdmin: users.isAdmin, canCreateGroups: users.canCreateGroups })
            .from(users)
            .where(eq(users.id, realId))
            .limit(1))[0];
          if (realUser) {
            session.user = {
              id: realUser.id,
              name: realUser.name,
              email: realUser.email,
              image: realUser.image,
              isAdmin: realUser.isAdmin ?? false,
              canCreateGroups: realUser.canCreateGroups ?? false,
              emailVerified: null,
            };
          }
          // If real user also missing, leave session as-is (token.id fallback below)
        }
      }
      if (!session.realUserId) {
        if (token?.id) {
          session.user.id = token.id as string;
        }
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
        session.user.canCreateGroups = (token.canCreateGroups as boolean) ?? false;
      }
      return session;
    },
  },
});
