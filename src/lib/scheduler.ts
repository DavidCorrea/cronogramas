import {
  MemberInfo,
  RoleDefinition,
  ScheduleAssignment,
  SchedulerInput,
  SchedulerOutput,
} from "./scheduler-types";
import { getDayNameFromDateString } from "./dates";

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm ?? "00:00").trim().split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(1439, Math.max(0, h * 60 + m));
}

function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aS = parseTimeToMinutes(aStart);
  const aE = parseTimeToMinutes(aEnd);
  const bS = parseTimeToMinutes(bStart);
  const bE = parseTimeToMinutes(bEnd);
  return aS < bE && bS < aE;
}

function isOnHoliday(member: MemberInfo, dateStr: string): boolean {
  return member.holidays.some(
    (h) => dateStr >= h.startDate && dateStr <= h.endDate
  );
}

/**
 * Sort roles by day-specific priorities. Roles with lower priority numbers
 * are processed first. Roles without an explicit priority keep their original order.
 */
function sortRolesByPriority(
  roles: RoleDefinition[],
  dayOfWeek: string,
  dayRolePriorities?: Record<string, Record<number, number>>
): RoleDefinition[] {
  if (!dayRolePriorities || !dayRolePriorities[dayOfWeek]) {
    return roles;
  }

  const priorities = dayRolePriorities[dayOfWeek];
  const originalIndex = new Map(roles.map((r, i) => [r, i]));
  const sorted = [...roles];

  sorted.sort((a, b) => {
    const prioA = priorities[a.id] ?? Infinity;
    const prioB = priorities[b.id] ?? Infinity;
    if (prioA !== prioB) return prioA - prioB;
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });

  return sorted;
}

/**
 * Walk the rotation list starting from the given pointer, checking each
 * candidate against the filter function. Returns the chosen member ID and
 * the new pointer position, or null if no eligible member is found.
 */
function pickFromRotation(
  list: number[],
  pointer: number,
  isEligible: (memberId: number) => boolean
): { memberId: number; newPointer: number } | null {
  const len = list.length;
  for (let i = 0; i < len; i++) {
    const idx = (pointer + i) % len;
    const memberId = list[idx];
    if (isEligible(memberId)) {
      return { memberId, newPointer: (idx + 1) % len };
    }
  }
  return null;
}

/**
 * Checks whether a member can fill a role on a given date, considering
 * availability, holidays, exclusive groups, duplicate roles, and time windows.
 */
function isMemberEligible(
  member: MemberInfo,
  date: string,
  dayOfWeek: string,
  role: RoleDefinition,
  rolesOnDate: Map<number, Set<number>>,
  exclusiveOnDate: Map<number, Map<number, number>>,
  eventWindow?: { startUtc: string; endUtc: string }
): boolean {
  if (!member.availableDays.includes(dayOfWeek)) return false;
  if (isOnHoliday(member, date)) return false;
  if (rolesOnDate.get(member.id)?.has(role.id)) return false;

  if (role.exclusiveGroupId) {
    const assignedRoleId = exclusiveOnDate
      .get(member.id)
      ?.get(role.exclusiveGroupId);
    if (assignedRoleId !== undefined && assignedRoleId !== role.id) return false;
  }

  if (eventWindow) {
    const blocks = member.availabilityBlocksByDay?.[dayOfWeek];
    if (!blocks?.length) return false;
    const overlaps = blocks.some((block) =>
      timeRangesOverlap(
        eventWindow.startUtc,
        eventWindow.endUtc,
        block.startUtc,
        block.endUtc
      )
    );
    if (!overlaps) return false;
  }

  return true;
}

/** Initialise per-role per-day-of-week pointers from the previous month's assignments. */
function initializePointers(
  roles: RoleDefinition[],
  rotationLists: Map<number, number[]>,
  previousAssignments: ScheduleAssignment[]
): Map<number, Map<string, number>> {
  const pointers = new Map<number, Map<string, number>>();

  for (const role of roles) {
    const list = rotationLists.get(role.id)!;
    if (list.length === 0) continue;

    const lastMemberByDay = new Map<
      string,
      { memberId: number; date: string }
    >();
    for (const pa of previousAssignments) {
      if (pa.roleId !== role.id) continue;
      const dow = getDayNameFromDateString(pa.date);
      const current = lastMemberByDay.get(dow);
      if (!current || pa.date > current.date) {
        lastMemberByDay.set(dow, { memberId: pa.memberId, date: pa.date });
      }
    }

    const dayPointers = new Map<string, number>();
    for (const [dow, { memberId }] of lastMemberByDay) {
      const idx = list.indexOf(memberId);
      if (idx !== -1) {
        dayPointers.set(dow, (idx + 1) % list.length);
      }
    }
    if (dayPointers.size > 0) {
      pointers.set(role.id, dayPointers);
    }
  }

  return pointers;
}

function recordExclusiveGroup(
  memberId: number,
  role: RoleDefinition,
  exclusiveOnDate: Map<number, Map<number, number>>
): void {
  if (role.exclusiveGroupId == null) return;
  if (!exclusiveOnDate.has(memberId)) {
    exclusiveOnDate.set(memberId, new Map());
  }
  exclusiveOnDate.get(memberId)!.set(role.exclusiveGroupId, role.id);
}

function recordRoleAssignment(
  memberId: number,
  roleId: number,
  rolesOnDate: Map<number, Set<number>>
): void {
  if (!rolesOnDate.has(memberId)) {
    rolesOnDate.set(memberId, new Set());
  }
  rolesOnDate.get(memberId)!.add(roleId);
}

/**
 * Generates a fair, rotational schedule for the given dates, roles, and members.
 *
 * Algorithm (round-robin with per-day-of-week pointers):
 * 1. For each role, build an alphabetically-sorted rotation list of capable members
 *    and maintain a per-day-of-week pointer that cycles through it independently
 *    for each day (e.g. the Wednesday drummer rotation is separate from Sunday's).
 * 2. When filling a slot, walk from the pointer until an eligible candidate is found
 *    (available that day, not on holiday, not blocked by exclusive group), assign them,
 *    and advance the pointer past them.
 * 3. If previousAssignments are provided, initialise each per-day pointer to the
 *    position after the last member assigned that role on that day of the week.
 * 4. Report any slots that could not be filled.
 *
 * Note: Dependent roles (e.g. Leader depends on Voice) are NOT passed to the
 * scheduler. They are manually assigned by the user in the schedule detail UI.
 */
export function generateSchedule(input: SchedulerInput): SchedulerOutput {
  const {
    dates,
    roles,
    members,
    previousAssignments = [],
    dayRolePriorities,
    dayEventTimeWindow,
  } = input;

  const memberById = new Map(members.map((m) => [m.id, m] as const));
  const roleById = new Map(roles.map((r) => [r.id, r] as const));
  const rotationLists = new Map(
    roles.map((role) => [
      role.id,
      members
        .filter((m) => m.roleIds.includes(role.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => m.id),
    ] as const)
  );
  const rolePointers = initializePointers(roles, rotationLists, previousAssignments);

  const assignments: ScheduleAssignment[] = [];
  const unfilledSlots: SchedulerOutput["unfilledSlots"] = [];

  for (const date of dates) {
    const dayOfWeek = getDayNameFromDateString(date);
    const eventWindow = dayEventTimeWindow?.[dayOfWeek];
    const orderedRoles = sortRolesByPriority(roles, dayOfWeek, dayRolePriorities);

    const exclusiveOnDate = new Map<number, Map<number, number>>();
    const rolesOnDate = new Map<number, Set<number>>();

    for (const pa of previousAssignments) {
      if (pa.date !== date) continue;
      const paRole = roleById.get(pa.roleId);
      if (paRole) recordExclusiveGroup(pa.memberId, paRole, exclusiveOnDate);
    }

    for (const role of orderedRoles) {
      if (!rolePointers.has(role.id)) rolePointers.set(role.id, new Map());
      const dayPointers = rolePointers.get(role.id)!;

      for (let slot = 0; slot < role.requiredCount; slot++) {
        const pointer = dayPointers.get(dayOfWeek) ?? 0;
        const list = rotationLists.get(role.id)!;

        const result = pickFromRotation(list, pointer, (memberId) =>
          isMemberEligible(
            memberById.get(memberId)!,
            date,
            dayOfWeek,
            role,
            rolesOnDate,
            exclusiveOnDate,
            eventWindow
          )
        );

        if (!result) {
          unfilledSlots.push({ date, roleId: role.id });
          continue;
        }

        assignments.push({ date, roleId: role.id, memberId: result.memberId });
        dayPointers.set(dayOfWeek, result.newPointer);
        recordExclusiveGroup(result.memberId, role, exclusiveOnDate);
        recordRoleAssignment(result.memberId, role.id, rolesOnDate);
      }
    }
  }

  return { assignments, unfilledSlots };
}
