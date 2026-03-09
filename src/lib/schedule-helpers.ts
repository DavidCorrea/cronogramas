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
import { MemberInfo, RecurringEventConfig, RoleDefinition } from "./scheduler-types";
import {
  filterSchedulableRoles,
  getDependentRoleIds,
  resolveHolidaysForMember,
  EVENT_DEFAULTS,
} from "./schedule-model";

export interface ScheduleConfig {
  activeDayNames: string[];
  recurringEvents: RecurringEventConfig[];
  roleDefinitions: RoleDefinition[];
  allRoles: typeof roles.$inferSelect[];
  dependentRoleIds: Set<number>;
  memberInfos: MemberInfo[];
}

/**
 * Load all configuration needed to run the scheduler for a group.
 * Returns every active recurring event (multiple per weekday allowed) with
 * per-event role priorities. The caller passes this to generateGroupSchedule.
 */
export async function loadScheduleConfig(groupId: number): Promise<ScheduleConfig> {
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

  const activeRows = allRecurringRows.filter((d) => d.active && d.weekdayName);
  const assignableIds = activeRows
    .filter((d) => String(d.type).toLowerCase() !== "for_everyone")
    .map((d) => d.id);

  const allPriorities = assignableIds.length > 0
    ? await db.select().from(eventRolePriorities).where(inArray(eventRolePriorities.recurringEventId, assignableIds))
    : [];

  const prioritiesByEvent = new Map<number, Record<number, number>>();
  for (const p of allPriorities) {
    if (!prioritiesByEvent.has(p.recurringEventId)) {
      prioritiesByEvent.set(p.recurringEventId, {});
    }
    prioritiesByEvent.get(p.recurringEventId)![p.roleId] = p.priority;
  }

  const recurringEventConfigs: RecurringEventConfig[] = activeRows.map((d) => ({
    id: d.id,
    weekdayName: d.weekdayName!,
    type: String(d.type).toLowerCase() === "for_everyone" ? "for_everyone" as const : "assignable" as const,
    label: d.label ?? EVENT_DEFAULTS.label,
    startTimeUtc: d.startTimeUtc ?? EVENT_DEFAULTS.startTimeUtc,
    endTimeUtc: d.endTimeUtc ?? EVENT_DEFAULTS.endTimeUtc,
    rolePriorities: prioritiesByEvent.get(d.id) ?? {},
  }));

  const activeDayNames = [
    ...new Set(recurringEventConfigs.map((e) => e.weekdayName)),
  ];

  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, groupId));
  const roleDefinitions: RoleDefinition[] = filterSchedulableRoles(allRoles);

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

    const mHolidays = resolveHolidaysForMember({
      memberId: m.id,
      linkedUserId: m.userId,
      allHolidays,
    });

    memberInfos.push({
      id: m.id,
      name: m.name,
      roleIds: mRoles.map((r) => r.roleId),
      availableDays: availDayNames,
      availabilityBlocksByDay,
      holidays: mHolidays,
    });
  }

  return {
    activeDayNames,
    recurringEvents: recurringEventConfigs,
    roleDefinitions,
    allRoles,
    dependentRoleIds: getDependentRoleIds(allRoles),
    memberInfos,
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

