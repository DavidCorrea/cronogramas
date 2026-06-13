import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadUserGroups } from "@/lib/data-access";
import { getAssignments } from "@/lib/user-assignments";
import { buildConflicts } from "@/lib/dashboard-conflicts";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DashboardContentSkeleton } from "@/components/Skeletons";
import DashboardClient from "./DashboardClient";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("home");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Suspense fallback={<DashboardContentSkeleton />}>
          <DashboardContent userId={session.user.id} />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardContent({ userId }: { userId: string }) {
  const [userGroups, assignments, dbUser] = await Promise.all([
    loadUserGroups(userId),
    getAssignments(userId),
    db
      .select({ isAdmin: users.isAdmin, canCreateGroups: users.canCreateGroups })
      .from(users)
      .where(eq(users.id, userId))
      .then((rows) => rows[0]),
  ]);

  const conflicts = buildConflicts(assignments);

  const groups = userGroups.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    role: g.role,
  }));

  return (
    <DashboardClient
      groups={groups}
      assignments={assignments}
      conflicts={conflicts}
      canCreate={dbUser?.isAdmin || dbUser?.canCreateGroups || false}
    />
  );
}
