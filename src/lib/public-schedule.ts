import { db } from "./db";
import {
  schedules,
  scheduleDateAssignments,
  scheduleDate,
  members,
  roles,
  groups,
  recurringEvents,
} from "@/db/schema";
import { eq, and, or, lt, gt, asc, desc } from "drizzle-orm";
import { getHolidayConflicts } from "./holiday-conflicts";

/**
 * Build the full public schedule response for a committed schedule.
 * Used by both the current-month and specific-month public APIs.
 */
export async function buildPublicScheduleResponse(schedule: {
  id: number;
  month: number;
  year: number;
  groupId: number;
}) {
  const { id, month, year, groupId } = schedule;

  const group = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .then((rows) => rows[0]);

  const entriesWithDate = await db
    .select({
      id: scheduleDateAssignments.id,
      scheduleDateId: scheduleDateAssignments.scheduleDateId,
      date: scheduleDate.date,
      roleId: scheduleDateAssignments.roleId,
      memberId: scheduleDateAssignments.memberId,
    })
    .from(scheduleDateAssignments)
    .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
    .where(eq(scheduleDate.scheduleId, id));

  const allMembers = await db
    .select({
      id: members.id,
      name: members.name,
      groupId: members.groupId,
    })
    .from(members)
    .where(eq(members.groupId, groupId));

  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, groupId));

  const dependentRoleIds = allRoles
    .filter((r) => r.dependsOnRoleId != null)
    .map((r) => r.id);

  const enrichedEntries = entriesWithDate.map((entry) => ({
    ...entry,
    memberName:
      allMembers.find((m) => m.id === entry.memberId)?.name ?? "Desconocido",
    roleName: allRoles.find((r) => r.id === entry.roleId)?.name ?? "Desconocido",
  }));

  const uniqueMembers = [
    ...new Map(
      entriesWithDate.map((e) => {
        const member = allMembers.find((m) => m.id === e.memberId);
        return [e.memberId, { id: e.memberId, name: member?.name ?? "Desconocido" }];
      })
    ).values(),
  ].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const scheduleDates = await db
    .select({
      date: scheduleDate.date,
      type: scheduleDate.type,
      label: scheduleDate.label,
      note: scheduleDate.note,
      startTimeUtc: scheduleDate.startTimeUtc,
      endTimeUtc: scheduleDate.endTimeUtc,
      recurringEventId: scheduleDate.recurringEventId,
      recurringEventLabel: recurringEvents.label,
    })
    .from(scheduleDate)
    .leftJoin(recurringEvents, eq(scheduleDate.recurringEventId, recurringEvents.id))
    .where(eq(scheduleDate.scheduleId, id))
    .orderBy(asc(scheduleDate.date));

  const notes = scheduleDates
    .filter((sd) => sd.note != null && sd.note.trim() !== "")
    .map((sd) => ({ date: sd.date, description: sd.note! }));

  // Find previous and next committed schedules for navigation (same group)
  const prevSchedule =
    (await db
      .select({ month: schedules.month, year: schedules.year })
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, groupId),
          eq(schedules.status, "committed"),
          or(
            lt(schedules.year, year),
            and(eq(schedules.year, year), lt(schedules.month, month))
          )
        )
      )
      .orderBy(desc(schedules.year), desc(schedules.month))
      .limit(1))[0] ?? null;

  const nextSchedule =
    (await db
      .select({ month: schedules.month, year: schedules.year })
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, groupId),
          eq(schedules.status, "committed"),
          or(
            gt(schedules.year, year),
            and(eq(schedules.year, year), gt(schedules.month, month))
          )
        )
      )
      .orderBy(asc(schedules.year), asc(schedules.month))
      .limit(1))[0] ?? null;

  const holidayConflicts = await getHolidayConflicts(
    entriesWithDate.map((e) => ({ date: e.date, memberId: e.memberId })),
    groupId
  );

  return {
    groupName: group?.name ?? undefined,
    month,
    year,
    entries: enrichedEntries,
    members: uniqueMembers,
    notes,
    scheduleDates: scheduleDates.map((sd) => ({
      date: sd.date,
      type: String(sd.type).toLowerCase() === "for_everyone" ? "for_everyone" : "assignable",
      label: sd.label,
      note: sd.note,
      startTimeUtc: sd.startTimeUtc ?? "00:00",
      endTimeUtc: sd.endTimeUtc ?? "23:59",
      recurringEventId: sd.recurringEventId ?? null,
      recurringEventLabel: sd.recurringEventLabel ?? null,
    })),
    dependentRoleIds,
    roles: allRoles,
    prevSchedule,
    nextSchedule,
    holidayConflicts,
  };
}
