import { db } from "@/lib/db";
import {
  members,
  scheduleDateAssignments,
  scheduleDate,
  schedules,
  roles,
  groups,
} from "@/db/schema";
import { eq, and, gte, inArray, asc } from "drizzle-orm";

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
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId));

  if (userMembers.length === 0) return [];

  const memberIds = userMembers.map((m) => m.id);

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Single set-based join: every committed assignment for any of the user's
  // memberships, from the current month onward, enriched with role and group.
  const rows = await db
    .select({
      date: scheduleDate.date,
      startTimeUtc: scheduleDate.startTimeUtc,
      endTimeUtc: scheduleDate.endTimeUtc,
      roleName: roles.name,
      groupName: groups.name,
      groupSlug: groups.slug,
      groupId: groups.id,
      groupCalendarExportEnabled: groups.calendarExportEnabled,
    })
    .from(scheduleDateAssignments)
    .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
    .innerJoin(schedules, eq(scheduleDate.scheduleId, schedules.id))
    .innerJoin(groups, eq(schedules.groupId, groups.id))
    .innerJoin(roles, eq(scheduleDateAssignments.roleId, roles.id))
    .where(
      and(
        inArray(scheduleDateAssignments.memberId, memberIds),
        eq(schedules.status, "committed"),
        gte(scheduleDate.date, firstOfMonth),
      ),
    )
    .orderBy(asc(scheduleDate.date));

  return rows.map((r) => ({
    date: r.date,
    startTimeUtc: r.startTimeUtc,
    endTimeUtc: r.endTimeUtc,
    roleName: r.roleName ?? "Desconocido",
    groupName: r.groupName,
    groupSlug: r.groupSlug,
    groupId: r.groupId,
    groupCalendarExportEnabled: r.groupCalendarExportEnabled,
  }));
}
