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
  startTimeUtc: string;
  endTimeUtc: string;
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

  type EntryWithGroup = {
    date: string;
    startTimeUtc: string;
    endTimeUtc: string;
    roleId: number;
    groupName: string;
    groupSlug: string;
    groupId: number;
    groupCalendarExportEnabled: boolean;
  };

  const entriesWithGroup: EntryWithGroup[] = [];

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
        .select({
          id: scheduleDate.id,
          date: scheduleDate.date,
          startTimeUtc: scheduleDate.startTimeUtc,
          endTimeUtc: scheduleDate.endTimeUtc,
        })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, schedule.id),
            gte(scheduleDate.date, firstOfMonth)
          )
        );

      const scheduleDateIds = scheduleDatesInRange.map((sd) => sd.id);
      const infoByScheduleDateId = new Map(
        scheduleDatesInRange.map((sd) => [
          sd.id,
          {
            date: sd.date,
            startTimeUtc: sd.startTimeUtc,
            endTimeUtc: sd.endTimeUtc,
          },
        ])
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
        const info = infoByScheduleDateId.get(entry.scheduleDateId);
        if (!info) continue;
        entriesWithGroup.push({
          date: info.date,
          startTimeUtc: info.startTimeUtc,
          endTimeUtc: info.endTimeUtc,
          roleId: entry.roleId,
          groupName: group.name,
          groupSlug: group.slug,
          groupId: group.id,
          groupCalendarExportEnabled: group.calendarExportEnabled,
        });
      }
    }
  }

  if (entriesWithGroup.length === 0) return [];

  const roleIds = [...new Set(entriesWithGroup.map((e) => e.roleId))];
  const rolesRows = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(inArray(roles.id, roleIds));

  const roleNameById = new Map(rolesRows.map((r) => [r.id, r.name]));

  const allAssignments: UserAssignment[] = entriesWithGroup.map((e) => ({
    date: e.date,
    startTimeUtc: e.startTimeUtc,
    endTimeUtc: e.endTimeUtc,
    roleName: roleNameById.get(e.roleId) ?? "Desconocido",
    groupName: e.groupName,
    groupSlug: e.groupSlug,
    groupId: e.groupId,
    groupCalendarExportEnabled: e.groupCalendarExportEnabled,
  }));

  allAssignments.sort((a, b) => a.date.localeCompare(b.date));
  return allAssignments;
}
