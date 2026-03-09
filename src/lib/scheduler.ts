import {
  MemberInfo,
  RoleDefinition,
  ScheduleAssignment,
  SchedulerInput,
  SchedulerOutput,
} from "./scheduler-types";
import { getDayNameFromDateString } from "./dates";

/** Parse "HH:MM" to minutes since midnight (0–1439). */
function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm ?? "00:00").trim().split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(1439, Math.max(0, h * 60 + m));
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd) (times in HH:MM). */
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

/**
 * Returns the capitalised Spanish day-of-week name for an ISO date string
 * (e.g. "2026-03-04" → "Miércoles"). Uses shared date helper for consistency with schedule creation.
 */
function getDayOfWeek(dateStr: string): string {
  return getDayNameFromDateString(dateStr);
}

/**
 * Checks whether a given date falls within any of the member's holiday periods.
 */
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
  const sorted = [...roles];

  sorted.sort((a, b) => {
    const prioA = priorities[a.id] ?? Infinity;
    const prioB = priorities[b.id] ?? Infinity;
    if (prioA !== prioB) return prioA - prioB;
    // Preserve original order for roles with equal priority
    return roles.indexOf(a) - roles.indexOf(b);
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

  const assignments: ScheduleAssignment[] = [];
  const unfilledSlots: SchedulerOutput["unfilledSlots"] = [];

  const memberById = new Map<number, MemberInfo>();
  for (const m of members) {
    memberById.set(m.id, m);
  }

  // Build role lookup by ID (for resolving exclusive groups from previousAssignments)
  const roleById = new Map<number, RoleDefinition>();
  for (const role of roles) {
    roleById.set(role.id, role);
  }

  // Build per-role rotation lists (alphabetically sorted by member name)
  const roleRotationLists = new Map<number, number[]>();
  for (const role of roles) {
    const capableMembers = members
      .filter((m) => m.roleIds.includes(role.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => m.id);
    roleRotationLists.set(role.id, capableMembers);
  }

  // Per-role per-day-of-week pointers
  // roleId → dayOfWeek → pointer index
  const rolePointers = new Map<number, Map<string, number>>();

  // Initialise pointers from previousAssignments (per-day-of-week)
  for (const role of roles) {
    const list = roleRotationLists.get(role.id)!;
    if (list.length === 0) continue;

    const lastMemberByDay = new Map<string, { memberId: number; date: string }>();
    for (const pa of previousAssignments) {
      if (pa.roleId !== role.id) continue;
      const dow = getDayOfWeek(pa.date);
      const current = lastMemberByDay.get(dow);
      if (!current || pa.date > current.date) {
        lastMemberByDay.set(dow, { memberId: pa.memberId, date: pa.date });
      }
    }

    if (!rolePointers.has(role.id)) {
      rolePointers.set(role.id, new Map());
    }
    const dayPointers = rolePointers.get(role.id)!;
    for (const [dow, { memberId }] of lastMemberByDay) {
      const idx = list.indexOf(memberId);
      if (idx !== -1) {
        dayPointers.set(dow, (idx + 1) % list.length);
      }
    }
  }

  for (const date of dates) {
    const dayOfWeek = getDayOfWeek(date);
    // Track exclusive groups: memberId → exclusiveGroupId → roleId assigned.
    // Allows same role across events but blocks different roles from the same group.
    const memberExclusiveOnDate = new Map<number, Map<number, number>>();
    // Track which role IDs each member is already assigned on this date (to prevent duplicates)
    const memberRolesOnDate = new Map<number, Set<number>>();

    // Pre-populate exclusive-group tracking from previousAssignments on this date
    for (const pa of previousAssignments) {
      if (pa.date !== date) continue;
      const paRole = roleById.get(pa.roleId);
      if (paRole?.exclusiveGroupId != null) {
        if (!memberExclusiveOnDate.has(pa.memberId)) {
          memberExclusiveOnDate.set(pa.memberId, new Map());
        }
        memberExclusiveOnDate.get(pa.memberId)!.set(paRole.exclusiveGroupId, pa.roleId);
      }
    }

    // Sort roles by day-specific priority
    const orderedRoles = sortRolesByPriority(roles, dayOfWeek, dayRolePriorities);

    // Process roles in order
    for (const role of orderedRoles) {
      const list = roleRotationLists.get(role.id)!;
      if (!rolePointers.has(role.id)) {
        rolePointers.set(role.id, new Map());
      }
      const dayPointers = rolePointers.get(role.id)!;

      for (let slot = 0; slot < role.requiredCount; slot++) {
        const pointer = dayPointers.get(dayOfWeek) ?? 0;

        const isEligible = (memberId: number): boolean => {
          const m = memberById.get(memberId)!;
          if (!m.availableDays.includes(dayOfWeek)) return false;
          if (isOnHoliday(m, date)) return false;
          if (memberRolesOnDate.get(m.id)?.has(role.id)) return false;
          if (role.exclusiveGroupId) {
            const memberExclusive = memberExclusiveOnDate.get(m.id);
            if (memberExclusive?.has(role.exclusiveGroupId)) {
              const existingRoleId = memberExclusive.get(role.exclusiveGroupId)!;
              if (existingRoleId !== role.id) return false;
            }
          }
          // If event has a time window, member must have at least one availability block overlapping it
          const eventWindow = dayEventTimeWindow?.[dayOfWeek];
          if (eventWindow) {
            const blocks = m.availabilityBlocksByDay?.[dayOfWeek];
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
        };

        const result = pickFromRotation(list, pointer, isEligible);

        if (!result) {
          unfilledSlots.push({ date, roleId: role.id });
          continue;
        }

        const chosen = memberById.get(result.memberId)!;
        assignments.push({ date, roleId: role.id, memberId: chosen.id });
        dayPointers.set(dayOfWeek, result.newPointer);

        // Track exclusive group: which role was assigned from this group
        if (role.exclusiveGroupId != null) {
          if (!memberExclusiveOnDate.has(chosen.id)) {
            memberExclusiveOnDate.set(chosen.id, new Map());
          }
          memberExclusiveOnDate.get(chosen.id)!.set(role.exclusiveGroupId, role.id);
        }
        // Track assigned role IDs to prevent duplicates
        if (!memberRolesOnDate.has(chosen.id)) {
          memberRolesOnDate.set(chosen.id, new Set());
        }
        memberRolesOnDate.get(chosen.id)!.add(role.id);
      }
    }
  }

  return { assignments, unfilledSlots };
}
