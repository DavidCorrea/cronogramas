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
  // The events, roles and members of a group are independent of each other;
  // everything below depends on one of them, so this is two rounds of queries
  // rather than five in sequence.
  const [allRecurringRows, allRoles, allMembers] = await Promise.all([
    db
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
      .where(eq(recurringEvents.groupId, groupId)),
    db.select().from(roles).where(eq(roles.groupId, groupId)),
    db
      .select({
        id: members.id,
        name: members.name,
        userId: members.userId,
        groupId: members.groupId,
      })
      .from(members)
      .where(eq(members.groupId, groupId)),
  ]);

  const activeRows = allRecurringRows.filter((d) => d.active && d.weekdayName);
  const assignableIds = activeRows
    .filter((d) => String(d.type).toLowerCase() !== "for_everyone")
    .map((d) => d.id);

  const roleDefinitions: RoleDefinition[] = filterSchedulableRoles(allRoles);

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

  type AvailabilityRow = {
    memberId: number;
    weekdayName: string | null;
    startTimeUtc: string | null;
    endTimeUtc: string | null;
  };

  // Second round: everything that needed ids from the first. Member roles and
  // availability are fetched for the whole group at once rather than per
  // member, which would be an N+1 during schedule generation.
  const [allPriorities, allHolidays, allMemberRoles, allAvailability] = await Promise.all([
    assignableIds.length > 0
      ? db.select().from(eventRolePriorities).where(inArray(eventRolePriorities.recurringEventId, assignableIds))
      : Promise.resolve([] as typeof eventRolePriorities.$inferSelect[]),
    holidayConditions.length > 0
      ? db.select().from(holidays).where(or(...holidayConditions))
      : Promise.resolve([] as typeof holidays.$inferSelect[]),
    memberIds.length > 0
      ? db
          .select({ memberId: memberRoles.memberId, roleId: memberRoles.roleId })
          .from(memberRoles)
          .where(inArray(memberRoles.memberId, memberIds))
      : Promise.resolve([] as { memberId: number; roleId: number }[]),
    memberIds.length > 0
      ? db
          .select({
            memberId: memberAvailability.memberId,
            weekdayName: weekdays.name,
            startTimeUtc: memberAvailability.startTimeUtc,
            endTimeUtc: memberAvailability.endTimeUtc,
          })
          .from(memberAvailability)
          .innerJoin(weekdays, eq(memberAvailability.weekdayId, weekdays.id))
          .where(inArray(memberAvailability.memberId, memberIds))
      : Promise.resolve([] as AvailabilityRow[]),
  ]);

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

  const roleIdsByMember = new Map<number, number[]>();
  for (const r of allMemberRoles) {
    const list = roleIdsByMember.get(r.memberId) ?? [];
    list.push(r.roleId);
    roleIdsByMember.set(r.memberId, list);
  }

  const availabilityByMember = new Map<number, AvailabilityRow[]>();
  for (const a of allAvailability) {
    const list = availabilityByMember.get(a.memberId) ?? [];
    list.push(a);
    availabilityByMember.set(a.memberId, list);
  }

  const memberInfos: MemberInfo[] = [];
  for (const m of allMembers) {
    const mRoles = roleIdsByMember.get(m.id) ?? [];
    const mAvailability = availabilityByMember.get(m.id) ?? [];

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
      roleIds: mRoles,
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
  // Single join across the group's committed schedules instead of one query per
  // schedule. Uses the (group_id, status) index on schedules.
  const rows = await db
    .select({
      date: scheduleDate.date,
      roleId: scheduleDateAssignments.roleId,
      memberId: scheduleDateAssignments.memberId,
    })
    .from(scheduleDateAssignments)
    .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
    .innerJoin(schedules, eq(scheduleDate.scheduleId, schedules.id))
    .where(and(eq(schedules.groupId, groupId), eq(schedules.status, "committed")));

  return rows.map((e) => ({
    date: e.date,
    roleId: e.roleId,
    memberId: e.memberId,
  }));
}

