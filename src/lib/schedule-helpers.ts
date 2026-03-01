import { db } from "./db";
import {
  members,
  roles,
  memberRoles,
  memberAvailability,
  weekdays,
  recurringEvents,
  holidays,
  eventRolePriorities,
  schedules,
  scheduleDateAssignments,
  scheduleDate,
} from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { MemberInfo, RoleDefinition } from "./scheduler.types";
import { generateSchedule } from "./scheduler";
import { logScheduleAction } from "./audit-log";

export interface ScheduleConfig {
  activeDayNames: string[];
  /** Weekday name -> { type, label, recurringEventId, startTimeUtc, endTimeUtc } for schedule_date creation */
  recurringTypeByDay: Record<string, { type: string; label: string; recurringEventId?: number; startTimeUtc: string; endTimeUtc: string }>;
  roleDefinitions: RoleDefinition[];
  allRoles: typeof roles.$inferSelect[];
  memberInfos: MemberInfo[];
  dayRolePriorityMap: Record<string, Record<number, number>>;
  /** Event time window per day (Spanish day name). Used by scheduler to filter by availability overlap. */
  dayEventTimeWindow: Record<string, { startUtc: string; endUtc: string }>;
}

/**
 * Load all configuration needed to run the scheduler for a group.
 * Builds activeDayNames from the canonical weekdays list so every active day is included (assignable and for_everyone).
 */
export async function loadScheduleConfig(groupId: number): Promise<ScheduleConfig> {
  const weekdayRows = await db
    .select({ id: weekdays.id, name: weekdays.name })
    .from(weekdays)
    .orderBy(weekdays.displayOrder);

  const allRecurringRows = await db
    .select({
      id: recurringEvents.id,
      weekdayId: recurringEvents.weekdayId,
      weekdayName: weekdays.name,
      active: recurringEvents.active,
      type: recurringEvents.type,
      label: recurringEvents.label,
      startTimeUtc: recurringEvents.startTimeUtc,
      endTimeUtc: recurringEvents.endTimeUtc,
      groupId: recurringEvents.groupId,
    })
    .from(recurringEvents)
    .innerJoin(weekdays, eq(recurringEvents.weekdayId, weekdays.id))
    .where(eq(recurringEvents.groupId, groupId));

  // Build map: one row per active weekday. If duplicates exist, prefer for_everyone so it's never lost.
  const activeByWeekdayName = new Map<string, (typeof allRecurringRows)[number]>();
  for (const d of allRecurringRows) {
    if (!d.active || !d.weekdayName) continue;
    const existing = activeByWeekdayName.get(d.weekdayName);
    const isForEveryone = String(d.type).toLowerCase() === "for_everyone";
    const existingIsForEveryone = existing ? String(existing.type).toLowerCase() === "for_everyone" : false;
    if (!existing || (isForEveryone && !existingIsForEveryone)) {
      activeByWeekdayName.set(d.weekdayName, d);
    }
  }

  const recurringTypeByDay: Record<string, { type: string; label: string; recurringEventId: number; startTimeUtc: string; endTimeUtc: string }> = {};
  const activeDayNames: string[] = [];

  for (const w of weekdayRows) {
    const name = w.name ?? "";
    if (!name) continue;
    const row = activeByWeekdayName.get(name);
    if (row) {
      activeDayNames.push(name);
      const rawType = row.type;
      const type = String(rawType).toLowerCase() === "for_everyone" ? "for_everyone" : "assignable";
      recurringTypeByDay[name] = {
        type,
        label: row.label ?? "Evento",
        recurringEventId: row.id,
        startTimeUtc: row.startTimeUtc ?? "00:00",
        endTimeUtc: row.endTimeUtc ?? "23:59",
      };
    }
  }

  const activeRecurringRows = allRecurringRows.filter((d) => d.active);
  const assignableRecurringRows = activeRecurringRows.filter(
    (d) => String(d.type).toLowerCase() !== "for_everyone"
  );

  // Event time window per day (assignable only). Scheduler uses this to filter members by time overlap.
  const dayEventTimeWindow: Record<string, { startUtc: string; endUtc: string }> = {};
  for (const row of assignableRecurringRows) {
    const name = row.weekdayName ?? "";
    if (name) {
      dayEventTimeWindow[name] = {
        startUtc: row.startTimeUtc ?? "00:00",
        endUtc: row.endTimeUtc ?? "23:59",
      };
    }
  }

  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, groupId));
  const roleDefinitions: RoleDefinition[] = allRoles
    .filter((r) => r.dependsOnRoleId == null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      requiredCount: r.requiredCount,
      exclusiveGroupId: r.exclusiveGroupId,
    }));

  const allMembers = await db
    .select({
      id: members.id,
      name: members.name,
      userId: members.userId,
      groupId: members.groupId,
    })
    .from(members)
    .where(eq(members.groupId, groupId));

  const linkedUserIds = allMembers
    .filter((m) => m.userId != null)
    .map((m) => m.userId!);
  const memberIds = allMembers.map((m) => m.id);

  const holidayConditions = [];
  if (linkedUserIds.length > 0) {
    holidayConditions.push(inArray(holidays.userId, linkedUserIds));
  }
  if (memberIds.length > 0) {
    holidayConditions.push(inArray(holidays.memberId, memberIds));
  }

  const allHolidays = holidayConditions.length > 0
    ? await db.select().from(holidays).where(or(...holidayConditions))
    : [];

  const memberInfos: MemberInfo[] = [];
  for (const m of allMembers) {
    const mRoles = await db
      .select()
      .from(memberRoles)
      .where(eq(memberRoles.memberId, m.id));

    const mAvailability = await db
      .select({
        weekdayId: memberAvailability.weekdayId,
        weekdayName: weekdays.name,
        startTimeUtc: memberAvailability.startTimeUtc,
        endTimeUtc: memberAvailability.endTimeUtc,
      })
      .from(memberAvailability)
      .innerJoin(weekdays, eq(memberAvailability.weekdayId, weekdays.id))
      .where(eq(memberAvailability.memberId, m.id));

    const availDayNames = [...new Set(mAvailability.map((a) => a.weekdayName ?? "").filter(Boolean))];

    const availabilityBlocksByDay: Record<string, { startUtc: string; endUtc: string }[]> = {};
    for (const a of mAvailability) {
      const dayName = a.weekdayName ?? "";
      if (!dayName) continue;
      if (!availabilityBlocksByDay[dayName]) availabilityBlocksByDay[dayName] = [];
      availabilityBlocksByDay[dayName].push({
        startUtc: a.startTimeUtc ?? "00:00",
        endUtc: a.endTimeUtc ?? "23:59",
      });
    }

    const mHolidays = allHolidays
      .filter((h) => h.userId === m.userId || h.memberId === m.id)
      .map((h) => ({ startDate: h.startDate, endDate: h.endDate }));

    memberInfos.push({
      id: m.id,
      name: m.name,
      roleIds: mRoles.map((r) => r.roleId),
      availableDays: availDayNames,
      availabilityBlocksByDay,
      holidays: mHolidays,
    });
  }

  // Build day role priorities map (only for assignable recurring events)
  const assignableIds = assignableRecurringRows.map((d) => d.id);
  const allPriorities = assignableIds.length > 0
    ? await db.select().from(eventRolePriorities).where(inArray(eventRolePriorities.recurringEventId, assignableIds))
    : [];
  const dayRolePriorityMap: Record<string, Record<number, number>> = {};
  for (const p of allPriorities) {
    const ev = assignableRecurringRows.find((d) => d.id === p.recurringEventId);
    if (ev?.weekdayName) {
      if (!dayRolePriorityMap[ev.weekdayName]) {
        dayRolePriorityMap[ev.weekdayName] = {};
      }
      dayRolePriorityMap[ev.weekdayName][p.roleId] = p.priority;
    }
  }

  return {
    activeDayNames,
    recurringTypeByDay,
    roleDefinitions,
    allRoles,
    memberInfos,
    dayRolePriorityMap,
    dayEventTimeWindow,
  };
}

/**
 * Gather previous assignments from committed schedules for rotation continuity.
 */
export async function getPreviousAssignments(groupId: number) {
  const committedSchedules = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.groupId, groupId), eq(schedules.status, "committed")));

  const previousAssignments: { date: string; roleId: number; memberId: number }[] = [];
  for (const s of committedSchedules) {
    const rows = await db
      .select({
        date: scheduleDate.date,
        roleId: scheduleDateAssignments.roleId,
        memberId: scheduleDateAssignments.memberId,
      })
      .from(scheduleDateAssignments)
      .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
      .where(eq(scheduleDate.scheduleId, s.id));

    previousAssignments.push(
      ...rows.map((e) => ({
        date: e.date,
        roleId: e.roleId,
        memberId: e.memberId,
      }))
    );
  }
  return previousAssignments;
}

/**
 * Rebuild future assignable assignments for a schedule (overwrite mode).
 * Used when a recurring event's day or times change so assignments respect the new config.
 * Logs the action for audit. Caller must ensure the user has access to the schedule's group.
 */
export async function rebuildScheduleFutureAssignments(
  scheduleId: number,
  userId: string
): Promise<{ applied: number }> {
  const schedule = (await db.select().from(schedules).where(eq(schedules.id, scheduleId)))[0];
  if (!schedule) {
    throw new Error("Cronograma no encontrado");
  }
  const { groupId } = schedule;
  const today = new Date().toISOString().split("T")[0];

  const config = await loadScheduleConfig(groupId);

  const assignableDatesRows = await db
    .select({ date: scheduleDate.date, id: scheduleDate.id })
    .from(scheduleDate)
    .where(
      and(
        eq(scheduleDate.scheduleId, scheduleId),
        eq(scheduleDate.type, "assignable")
      )
    );
  const futureDates = assignableDatesRows
    .map((r) => r.date)
    .filter((d) => d >= today)
    .sort();
  const dateToSdId = new Map(assignableDatesRows.map((r) => [r.date, r.id]));

  if (futureDates.length === 0) {
    return { applied: 0 };
  }

  const currentEntriesWithDate = await db
    .select({
      id: scheduleDateAssignments.id,
      date: scheduleDate.date,
      roleId: scheduleDateAssignments.roleId,
      memberId: scheduleDateAssignments.memberId,
    })
    .from(scheduleDateAssignments)
    .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
    .where(eq(scheduleDate.scheduleId, scheduleId));

  const pastEntries = currentEntriesWithDate.filter((e) => e.date < today);
  const futureEntries = currentEntriesWithDate.filter((e) => e.date >= today);

  const previousAssignments = await getPreviousAssignments(groupId);
  const allPrevious = [
    ...previousAssignments,
    ...pastEntries.map((e) => ({ date: e.date, roleId: e.roleId, memberId: e.memberId })),
  ];

  const result = generateSchedule({
    dates: futureDates,
    roles: config.roleDefinitions,
    members: config.memberInfos,
    previousAssignments: allPrevious,
    dayRolePriorities:
      Object.keys(config.dayRolePriorityMap).length > 0 ? config.dayRolePriorityMap : undefined,
    dayEventTimeWindow:
      Object.keys(config.dayEventTimeWindow).length > 0 ? config.dayEventTimeWindow : undefined,
  });

  for (const e of futureEntries) {
    await db.delete(scheduleDateAssignments).where(eq(scheduleDateAssignments.id, e.id));
  }

  if (result.assignments.length > 0) {
    const toInsert = result.assignments
      .map((a) => {
        const scheduleDateId = dateToSdId.get(a.date);
        if (!scheduleDateId) return null;
        return {
          scheduleDateId,
          roleId: a.roleId,
          memberId: a.memberId,
        };
      })
      .filter(Boolean) as { scheduleDateId: number; roleId: number; memberId: number }[];
    if (toInsert.length > 0) {
      await db.insert(scheduleDateAssignments).values(toInsert);
    }
  }

  await logScheduleAction(scheduleId, userId, "rebuild", {
    message: `Reconstrucción por cambio de evento recurrente: ${result.assignments.length} asignación(es) regenerada(s)`,
    source: "recurring_event_update",
    applied: result.assignments.length,
  });

  return { applied: result.assignments.length };
}
