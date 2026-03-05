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
    };
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Fetch admin flags from DB on sign-in or when session is updated
      const userId = token.id as string | undefined;
      if (userId && (user || trigger === "update")) {
        const dbUser = (await db
          .select({ isAdmin: users.isAdmin, canCreateGroups: users.canCreateGroups })
          .from(users)
          .where(eq(users.id, userId)))[0];
        if (dbUser) {
          token.isAdmin = dbUser.isAdmin;
          token.canCreateGroups = dbUser.canCreateGroups;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      session.user.canCreateGroups = (token.canCreateGroups as boolean) ?? false;
      return session;
    },
  },
});
