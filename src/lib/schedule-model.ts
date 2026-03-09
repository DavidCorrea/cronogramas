import { getDayNameFromDateString } from "./dates";
import { generateSchedule } from "./scheduler";
import {
  EventAssignment,
  GroupScheduleInput,
  GroupScheduleResult,
  RecurringEventConfig,
  RoleDefinition,
  ScheduleDateOutput,
  ScheduleAssignment,
} from "./scheduler-types";

// ---------------------------------------------------------------------------
// Pure domain helpers — no DB access, usable from API routes and client
// ---------------------------------------------------------------------------

/** Domain defaults for recurring event fields when the DB value is null. */
export const EVENT_DEFAULTS = {
  label: "Evento",
  startTimeUtc: "00:00",
  endTimeUtc: "23:59",
} as const;

/**
 * Resolves which holidays apply to a member.
 * Linked members (userId != null) inherit both user-level and member-level
 * holidays; unlinked members get only member-level holidays.
 */
export function resolveHolidaysForMember(params: {
  memberId: number;
  linkedUserId: string | null;
  allHolidays: {
    userId: string | null;
    memberId: number | null;
    startDate: string;
    endDate: string;
  }[];
}): { startDate: string; endDate: string }[] {
  const { memberId, linkedUserId, allHolidays } = params;
  return allHolidays
    .filter((h) => {
      if (h.memberId === memberId) return true;
      if (linkedUserId != null && h.userId === linkedUserId) return true;
      return false;
    })
    .map((h) => ({ startDate: h.startDate, endDate: h.endDate }));
}

/**
 * Filters dates to only those on or after `today`.
 * Used by rebuild/recalculate flows so past assignments are never overwritten.
 */
export function filterRebuildableDates(
  dates: string[],
  today: string
): string[] {
  return dates.filter((d) => d >= today);
}

/**
 * Validates that a date string falls within the given schedule month/year.
 * Returns { valid: true } or { valid: false, reason } following the same
 * pattern as validateDependentRoleAssignment.
 */
export function validateDateInScheduleMonth(params: {
  date: string;
  month: number;
  year: number;
}): { valid: true } | { valid: false; reason: string } {
  const parts = params.date.split("-").map(Number);
  const [y, m] = parts;
  if (y !== params.year || m !== params.month) {
    return {
      valid: false,
      reason: "La fecha debe estar dentro del mes del cronograma",
    };
  }
  return { valid: true };
}

/**
 * Filters out dependent roles (roles with dependsOnRoleId) and maps to
 * RoleDefinition. Only independent roles are passed to the scheduler.
 */
export function filterSchedulableRoles(
  allRoles: {
    id: number;
    name: string;
    requiredCount: number;
    exclusiveGroupId?: number | null;
    dependsOnRoleId?: number | null;
  }[]
): RoleDefinition[] {
  return allRoles
    .filter((r) => r.dependsOnRoleId == null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      requiredCount: r.requiredCount,
      exclusiveGroupId: r.exclusiveGroupId ?? null,
    }));
}

/**
 * Validates that a member can be assigned to a dependent role.
 * Valid only when the role has dependsOnRoleId and the member is already
 * assigned to that source role on the same date.
 */
export function validateDependentRoleAssignment(params: {
  roleId: number;
  memberId: number;
  roles: { id: number; dependsOnRoleId: number | null }[];
  assignmentsOnDate: { roleId: number; memberId: number }[];
}): { valid: true } | { valid: false; reason: string } {
  const { roleId, memberId, roles, assignmentsOnDate } = params;

  const role = roles.find((r) => r.id === roleId);
  if (!role || role.dependsOnRoleId == null) {
    return { valid: false, reason: "El rol no es un rol dependiente" };
  }

  const isAssignedToSource = assignmentsOnDate.some(
    (a) => a.roleId === role.dependsOnRoleId && a.memberId === memberId
  );

  if (!isAssignedToSource) {
    return {
      valid: false,
      reason: "El miembro no está asignado al rol fuente en esta fecha",
    };
  }

  return { valid: true };
}

/**
 * Returns dates where any schedulable role has fewer assignments than its
 * requiredCount (ignoring dependent roles). Used by "fill empty" rebuild.
 */
export function computeDatesWithGaps(params: {
  dates: string[];
  currentAssignments: { date: string; roleId: number }[];
  roleDefinitions: RoleDefinition[];
  dependentRoleIds: Set<number>;
}): string[] {
  const { dates, currentAssignments, roleDefinitions, dependentRoleIds } =
    params;

  const filledSlots = new Map<string, number>();
  for (const a of currentAssignments) {
    if (dependentRoleIds.has(a.roleId)) continue;
    const key = `${a.date}|${a.roleId}`;
    filledSlots.set(key, (filledSlots.get(key) ?? 0) + 1);
  }

  const result = new Set<string>();
  for (const date of dates) {
    for (const role of roleDefinitions) {
      const filled = filledSlots.get(`${date}|${role.id}`) ?? 0;
      if (filled < role.requiredCount) {
        result.add(date);
      }
    }
  }
  return [...result].sort();
}

/**
 * Returns IDs of members eligible for a given role slot on a given date.
 * - Dependent roles: only members currently assigned to the source role.
 * - Regular roles: members with the role who are available that weekday
 *   (empty availableDays = available every day, for manual assignment UIs).
 */
export function getEligibleMemberIds(params: {
  role: { id: number; dependsOnRoleId: number | null };
  date: string;
  members: { id: number; roleIds: number[]; availableDays: string[] }[];
  assignmentsOnDate: { roleId: number; memberId: number }[];
}): number[] {
  const { role, date, members, assignmentsOnDate } = params;

  if (role.dependsOnRoleId != null) {
    const sourceMemberIds = new Set(
      assignmentsOnDate
        .filter((a) => a.roleId === role.dependsOnRoleId)
        .map((a) => a.memberId)
    );
    return members
      .filter((m) => sourceMemberIds.has(m.id) && m.roleIds.includes(role.id))
      .map((m) => m.id);
  }

  const dayName = getDayNameFromDateString(date);
  return members
    .filter((m) => {
      if (!m.roleIds.includes(role.id)) return false;
      if (m.availableDays.length === 0) return true;
      return m.availableDays.includes(dayName);
    })
    .map((m) => m.id);
}

/**
 * Returns the set of role IDs that are dependent (have dependsOnRoleId).
 */
export function getDependentRoleIds(
  allRoles: { id: number; dependsOnRoleId?: number | null }[]
): Set<number> {
  return new Set(
    allRoles.filter((r) => r.dependsOnRoleId != null).map((r) => r.id)
  );
}

/**
 * Returns true if the role is a dependent role (has dependsOnRoleId).
 */
export function isDependentRole(
  roleId: number,
  allRoles: { id: number; dependsOnRoleId?: number | null }[]
): boolean {
  const role = allRoles.find((r) => r.id === roleId);
  return role != null && role.dependsOnRoleId != null;
}

/**
 * Replaces a subset of scheduler assignments with preferred-member slots.
 * Used when a specific member should be guaranteed some assignments (e.g.
 * seed data for the group owner).
 *
 * Returns preferred slots (no recurringEventId) and remaining scheduler
 * assignments so callers can persist each group with the right FK.
 */
export function applyPreferredSlots<
  T extends { date: string; roleId: number; memberId: number },
>(params: {
  preferredMemberId: number;
  preferredRoleIds: number[];
  maxSlots: number;
  dates: string[];
  assignments: T[];
}): { preferred: { date: string; roleId: number; memberId: number }[]; remaining: T[] } {
  const { preferredMemberId, preferredRoleIds, maxSlots, dates, assignments } =
    params;

  if (preferredRoleIds.length === 0 || maxSlots === 0) {
    return { preferred: [], remaining: assignments };
  }

  const slotsToReserve = Math.min(maxSlots, dates.length);
  const preferred: { date: string; roleId: number; memberId: number }[] = [];
  for (let i = 0; i < slotsToReserve; i++) {
    const date = dates[i];
    if (!date) break;
    const roleId = preferredRoleIds[i % preferredRoleIds.length];
    preferred.push({ date, roleId, memberId: preferredMemberId });
  }

  const reservedKeys = new Set(
    preferred.map((a) => `${a.date}:${a.roleId}`)
  );
  const remaining = assignments.filter((a) => {
    const key = `${a.date}:${a.roleId}`;
    if (reservedKeys.has(key)) {
      reservedKeys.delete(key);
      return false;
    }
    return true;
  });

  return { preferred, remaining };
}

// ---------------------------------------------------------------------------
// Schedule generation orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates schedule generation for a group, handling multiple events per
 * day, cross-event exclusive groups, and round-robin continuity.
 *
 * For each date the caller provides, this function:
 * 1. Finds matching recurring events (by weekday name)
 * 2. Sorts them chronologically by startTimeUtc
 * 3. Emits a ScheduleDateOutput for every event (assignable and for_everyone)
 * 4. For assignable events, calls the low-level generateSchedule with the
 *    event's time window and role priorities, chaining assignments between
 *    events on the same date so exclusive-group constraints carry over
 * 5. Returns the accumulated schedule dates, assignments, and unfilled slots
 *
 * Pure function — no DB access.
 */
export function generateGroupSchedule(
  input: GroupScheduleInput
): GroupScheduleResult {
  const { dates, events, roles, members, previousAssignments = [] } = input;

  const scheduleDates: ScheduleDateOutput[] = [];
  const assignments: EventAssignment[] = [];
  const unfilledSlots: GroupScheduleResult["unfilledSlots"] = [];

  const eventsByWeekday = new Map<string, RecurringEventConfig[]>();
  for (const ev of events) {
    const list = eventsByWeekday.get(ev.weekdayName) ?? [];
    list.push(ev);
    eventsByWeekday.set(ev.weekdayName, list);
  }
  for (const list of eventsByWeekday.values()) {
    list.sort((a, b) => a.startTimeUtc.localeCompare(b.startTimeUtc));
  }

  const accumulated: ScheduleAssignment[] = [...previousAssignments];

  for (const date of dates) {
    const dayName = getDayNameFromDateString(date);
    const dayEvents = eventsByWeekday.get(dayName);
    if (!dayEvents?.length) continue;

    for (const ev of dayEvents) {
      scheduleDates.push({
        date,
        type: ev.type,
        label: ev.label,
        recurringEventId: ev.id,
        startTimeUtc: ev.startTimeUtc,
        endTimeUtc: ev.endTimeUtc,
      });

      if (ev.type === "for_everyone") continue;

      const eventRolePriorities: Record<string, Record<number, number>> = {};
      if (Object.keys(ev.rolePriorities).length > 0) {
        eventRolePriorities[dayName] = ev.rolePriorities;
      }

      const eventTimeWindow: Record<string, { startUtc: string; endUtc: string }> = {
        [dayName]: { startUtc: ev.startTimeUtc, endUtc: ev.endTimeUtc },
      };

      const result = generateSchedule({
        dates: [date],
        roles,
        members,
        previousAssignments: accumulated,
        dayRolePriorities:
          Object.keys(eventRolePriorities).length > 0
            ? eventRolePriorities
            : undefined,
        dayEventTimeWindow: eventTimeWindow,
      });

      for (const a of result.assignments) {
        const tagged: EventAssignment = { ...a, recurringEventId: ev.id };
        assignments.push(tagged);
        accumulated.push(a);
      }

      for (const u of result.unfilledSlots) {
        unfilledSlots.push({ ...u, recurringEventId: ev.id });
      }
    }
  }

  return { scheduleDates, assignments, unfilledSlots };
}
