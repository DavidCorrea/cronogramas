import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
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
import { findHolidayConflicts, loadConflictingHolidays } from "./holiday-conflicts";
import { monthRange } from "./month-range";

/**
 * Cache tag for a group's public schedule of a given month/year. Shared by the
 * `unstable_cache` wrapper around the builder and the `revalidateTag` call in
 * {@link revalidateCronograma}, so a single mutation invalidates both the ISR
 * page and the cached builder output.
 */
function cronogramaTag(groupId: number, year: number, month: number) {
  return `cronograma:${groupId}:${year}:${month}`;
}

/** Revalidate TTL, kept consistent with the SSR page (`revalidate = 300`). */
const CRONOGRAMA_REVALIDATE_SECONDS = 300;

/**
 * Revalidate the public cronograma page for a schedule's month: both the ISR
 * page and the cached builder output (via the shared tag).
 * Call after any mutation that changes the public view (commit, assignment
 * edit, date add/remove, note change, schedule delete).
 */
export async function revalidateCronograma(groupId: number, month: number, year: number) {
  // Next.js 16 requires a cache-life profile; "max" purges the tagged
  // `unstable_cache` entry on demand (read-after-write on the next request).
  revalidateTag(cronogramaTag(groupId, year, month), "max");

  const group = await db
    .select({ slug: groups.slug })
    .from(groups)
    .where(eq(groups.id, groupId))
    .then((rows) => rows[0]);
  if (group) {
    revalidatePath(`/${group.slug}/cronograma/${year}/${month}`);
  }
}

/**
 * Build the full public schedule response for a committed schedule.
 *
 * Pure DB reads keyed by primitives (no request/cookies access), so it is safe
 * to wrap in `unstable_cache` — see {@link buildPublicScheduleResponse}. The
 * group's name and calendar-export flag are passed in by the caller (which
 * already resolved the group), avoiding a redundant group lookup here.
 */
async function buildPublicScheduleResponseUncached(schedule: {
  id: number;
  month: number;
  year: number;
  groupId: number;
  groupName: string;
  calendarExportEnabled: boolean;
}) {
  const { id, month, year, groupId, groupName, calendarExportEnabled } = schedule;
  const { start: monthStart, end: monthEnd } = monthRange(year, month);

  const [
    entriesWithDate,
    allMembers,
    allRoles,
    scheduleDatesResult,
    prevSchedule,
    nextSchedule,
    conflictingHolidays,
  ] = await Promise.all([
    db
      .select({
        id: scheduleDateAssignments.id,
        scheduleDateId: scheduleDateAssignments.scheduleDateId,
        date: scheduleDate.date,
        roleId: scheduleDateAssignments.roleId,
        memberId: scheduleDateAssignments.memberId,
      })
      .from(scheduleDateAssignments)
      .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
      .where(eq(scheduleDate.scheduleId, id)),

    db
      .select({
        id: members.id,
        name: members.name,
        userId: members.userId,
      })
      .from(members)
      .where(eq(members.groupId, groupId)),

    db
      .select({
        id: roles.id,
        name: roles.name,
        displayOrder: roles.displayOrder,
        isRelevant: roles.isRelevant,
        dependsOnRoleId: roles.dependsOnRoleId,
      })
      .from(roles)
      .where(eq(roles.groupId, groupId)),

    db
      .select({
        id: scheduleDate.id,
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
      .orderBy(asc(scheduleDate.date), asc(scheduleDate.startTimeUtc)),

    db
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
      .limit(1)
      .then((rows) => rows[0] ?? null),

    db
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
      .limit(1)
      .then((rows) => rows[0] ?? null),

    loadConflictingHolidays(groupId, monthStart, monthEnd),
  ]);

  const holidayConflicts = findHolidayConflicts(
    entriesWithDate.map((e) => ({ date: e.date, memberId: e.memberId })),
    allMembers.map((m) => ({ id: m.id, name: m.name, userId: m.userId })),
    conflictingHolidays,
  );

  // Pure computation
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

  return {
    groupName: groupName ?? undefined,
    calendarExportEnabled,
    month,
    year,
    entries: enrichedEntries,
    members: uniqueMembers,
    scheduleDates: scheduleDatesResult.map((sd) => ({
      id: sd.id,
      date: sd.date,
      type: (String(sd.type).toLowerCase() === "for_everyone" ? "for_everyone" : "assignable") as "assignable" | "for_everyone",
      label: sd.label,
      note: sd.note,
      startTimeUtc: sd.startTimeUtc ?? "00:00",
      endTimeUtc: sd.endTimeUtc ?? "23:59",
      recurringEventLabel: sd.recurringEventLabel ?? null,
    })),
    dependentRoleIds,
    // Only the columns the public view renders (name, order, relevance).
    roles: allRoles.map((r) => ({
      id: r.id,
      name: r.name,
      displayOrder: r.displayOrder,
      isRelevant: r.isRelevant,
    })),
    prevSchedule,
    nextSchedule,
    // memberName is intentionally dropped — the view only needs date + memberId.
    holidayConflicts: holidayConflicts.map((c) => ({ date: c.date, memberId: c.memberId })),
  };
}

/**
 * Cached wrapper around {@link buildPublicScheduleResponseUncached}.
 *
 * Keyed by groupId + year + month + scheduleId and tagged with
 * `cronograma:${groupId}:${year}:${month}` so {@link revalidateCronograma}
 * invalidates it on commit/edit. TTL matches the SSR page (300s). This makes
 * the dynamic JSON API path cheap instead of re-querying on every request.
 */
export async function buildPublicScheduleResponse(schedule: {
  id: number;
  month: number;
  year: number;
  groupId: number;
  groupName: string;
  calendarExportEnabled: boolean;
}) {
  const { id, month, year, groupId } = schedule;
  const cached = unstable_cache(
    () => buildPublicScheduleResponseUncached(schedule),
    ["public-schedule", String(groupId), String(year), String(month), String(id)],
    {
      revalidate: CRONOGRAMA_REVALIDATE_SECONDS,
      tags: [cronogramaTag(groupId, year, month)],
    },
  );
  return cached();
}
