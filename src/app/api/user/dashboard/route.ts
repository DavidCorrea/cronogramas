import { NextResponse } from "next/server";
import { getAssignments } from "@/lib/user-assignments";
import { buildConflicts } from "@/lib/dashboard-conflicts";
import { requireAuth } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  const [userRow] = await db
    .select({ canExportCalendars: users.canExportCalendars })
    .from(users)
    .where(eq(users.id, userId));

  const allAssignments = await getAssignments(userId);

  const conflicts = buildConflicts(allAssignments);

  return NextResponse.json({
    assignments: allAssignments,
    conflicts,
    canExportCalendars: userRow?.canExportCalendars ?? false,
  });
}
