import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAssignments } from "@/lib/user-assignments";
import { buildConflicts } from "@/lib/dashboard-conflicts";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AssignmentsContentSkeleton } from "@/components/Skeletons";
import AssignmentsClient from "./AssignmentsClient";

export default async function AssignmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("myAssignments");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-4xl sm:text-5xl uppercase">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Suspense fallback={<AssignmentsContentSkeleton />}>
          <AssignmentsContent userId={session.user.id} />
        </Suspense>
      </div>
    </div>
  );
}

async function AssignmentsContent({ userId }: { userId: string }) {
  const [assignments, dbUser] = await Promise.all([
    getAssignments(userId),
    db
      .select({ canExportCalendars: users.canExportCalendars })
      .from(users)
      .where(eq(users.id, userId))
      .then((rows) => rows[0]),
  ]);

  const conflicts = buildConflicts(assignments);

  return (
    <AssignmentsClient
      assignments={assignments}
      conflicts={conflicts}
      canExportCalendars={dbUser?.canExportCalendars ?? false}
    />
  );
}
