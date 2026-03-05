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

export type UserAssignment = {
  date: string;
  roleName: string;
  groupName: string;
  groupSlug: string;
  groupId: number;
  groupCalendarExportEnabled: boolean;
};

/**
 * Fetches the user's assignments from committed schedules, from current month onward.
 * Same shape as dashboard and used by iCal export and Google Calendar sync.
 */
export async function getAssignments(userId: string): Promise<UserAssignment[]> {
  const userMembers = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId));

  if (userMembers.length === 0) return [];

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const allAssignments: UserAssignment[] = [];

  for (const membership of userMembers) {
    const group = (await db
      .select()
      .from(groups)
      .where(eq(groups.id, membership.groupId)))[0];
    if (!group) continue;

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
          groupCalendarExportEnabled: group.calendarExportEnabled,
        });
      }
    }
  }

  allAssignments.sort((a, b) => a.date.localeCompare(b.date));
  return allAssignments;
}
