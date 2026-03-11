/**
 * Time-aware conflict detection for the user dashboard.
 * A conflict exists when the user has two or more assignments on the same date
 * in different groups whose time ranges overlap (HH:MM UTC, inclusive end).
 */

export type AssignmentWithTime = {
  date: string;
  groupName: string;
  groupId: number;
  startTimeUtc: string;
  endTimeUtc: string;
};

/**
 * Returns true when the two time ranges [s1, e1] and [s2, e2] overlap.
 * End times are exclusive: a block ending at 12:00 does not overlap one starting at 12:00.
 * HH:MM strings compare correctly as strings.
 */
export function rangesOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string,
): boolean {
  return s1 < e2 && s2 < e1;
}

/**
 * Builds the list of conflicting dates: same date and at least one pair of
 * assignments from different groups with overlapping time ranges.
 * Returns { date, groups }[] where groups is the set of group names involved.
 */
export function buildConflicts(
  assignments: AssignmentWithTime[],
): { date: string; groups: string[] }[] {
  const byDate = new Map<string, AssignmentWithTime[]>();
  for (const a of assignments) {
    const list = byDate.get(a.date) ?? [];
    list.push(a);
    byDate.set(a.date, list);
  }

  const conflicts: { date: string; groups: string[] }[] = [];
  for (const [date, list] of byDate.entries()) {
    const groupNames = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.groupId === b.groupId) continue;
        if (rangesOverlap(a.startTimeUtc, a.endTimeUtc, b.startTimeUtc, b.endTimeUtc)) {
          groupNames.add(a.groupName);
          groupNames.add(b.groupName);
        }
      }
    }
    if (groupNames.size > 0) {
      conflicts.push({ date, groups: [...groupNames].sort() });
    }
  }
  conflicts.sort((a, b) => a.date.localeCompare(b.date));
  return conflicts;
}

/**
 * Returns the overlap span [start, end) of two ranges, or null if they do not overlap.
 * End is exclusive (same as rangesOverlap).
 */
export function getOverlapSpan(
  s1: string,
  e1: string,
  s2: string,
  e2: string,
): { start: string; end: string } | null {
  if (!rangesOverlap(s1, e1, s2, e2)) return null;
  const start = s1 >= s2 ? s1 : s2;
  const end = e1 <= e2 ? e1 : e2;
  return { start, end };
}

export type ConflictTimespan = {
  groupNames: string[];
  startUtc: string;
  endUtc: string;
};

/**
 * For a list of assignments (typically on the same date), returns each overlapping
 * pair's timespan (intersection). Used to show "in which timespan the conflict is".
 */
export function getConflictTimespans(
  assignments: AssignmentWithTime[],
): ConflictTimespan[] {
  const result: ConflictTimespan[] = [];
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      if (a.groupId === b.groupId) continue;
      const span = getOverlapSpan(
        a.startTimeUtc,
        a.endTimeUtc,
        b.startTimeUtc,
        b.endTimeUtc,
      );
      if (span) {
        result.push({
          groupNames: [a.groupName, b.groupName].sort(),
          startUtc: span.start,
          endUtc: span.end,
        });
      }
    }
  }
  return result;
}
