import { NextResponse } from "next/server";
import { getAssignments } from "@/lib/user-assignments";
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

  // Detect conflicts: same date in multiple groups
  const dateGroupMap = new Map<string, Set<string>>();
  for (const a of allAssignments) {
    if (!dateGroupMap.has(a.date)) {
      dateGroupMap.set(a.date, new Set());
    }
    dateGroupMap.get(a.date)!.add(a.groupName);
  }

  const conflicts = [...dateGroupMap.entries()]
    .filter(([, groupNames]) => groupNames.size > 1)
    .map(([date, groupNames]) => ({
      date,
      groups: [...groupNames],
    }));

  return NextResponse.json({
    assignments: allAssignments,
    conflicts,
    canExportCalendars: userRow?.canExportCalendars ?? false,
  });
}
