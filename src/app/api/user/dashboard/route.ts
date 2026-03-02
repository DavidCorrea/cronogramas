import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  members,
  scheduleDateAssignments,
  scheduleDate,
  schedules,
  roles,
  groups,
} from "@/db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  // Get all memberships for this user
  const userMembers = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId));

  if (userMembers.length === 0) {
    return NextResponse.json({ assignments: [], conflicts: [] });
  }

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Gather upcoming assignments across all groups
  const allAssignments: Array<{
    date: string;
    roleName: string;
    groupName: string;
    groupSlug: string;
    groupId: number;
  }> = [];

  for (const membership of userMembers) {
    const group = (await db
      .select()
      .from(groups)
      .where(eq(groups.id, membership.groupId)))[0];

    if (!group) continue;

    // Find committed schedules for this group
    const committedSchedules = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.groupId, membership.groupId), eq(schedules.status, "committed")));

    for (const schedule of committedSchedules) {
      const scheduleDatesInRange = await db
        .select({ id: scheduleDate.id, date: scheduleDate.date })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, schedule.id),
            gte(scheduleDate.date, firstOfMonth)
          )
        );

      const scheduleDateIds = scheduleDatesInRange.map((sd) => sd.id);
      const dateByScheduleDateId = new Map(
        scheduleDatesInRange.map((sd) => [sd.id, sd.date])
      );
      if (scheduleDateIds.length === 0) continue;

      const entries = await db
        .select()
        .from(scheduleDateAssignments)
        .where(
          and(
            inArray(scheduleDateAssignments.scheduleDateId, scheduleDateIds),
            eq(scheduleDateAssignments.memberId, membership.id)
          )
        );

      for (const entry of entries) {
        const date = dateByScheduleDateId.get(entry.scheduleDateId);
        if (!date) continue;

        const role = (await db
          .select()
          .from(roles)
          .where(eq(roles.id, entry.roleId)))[0];

        allAssignments.push({
          date,
          roleName: role?.name ?? "Desconocido",
          groupName: group.name,
          groupSlug: group.slug,
          groupId: group.id,
        });
      }
    }
  }

  // Sort by date
  allAssignments.sort((a, b) => a.date.localeCompare(b.date));

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

  return NextResponse.json({ assignments: allAssignments, conflicts });
}
