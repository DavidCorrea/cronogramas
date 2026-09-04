import { db } from "./db";
import { holidays, members } from "@/db/schema";
import { and, eq, gte, isNotNull, inArray, lte, or } from "drizzle-orm";

export interface HolidayConflict {
  date: string;
  memberId: number;
  memberName: string;
}

/**
 * Pure conflict detection: given schedule entries, group members, and all
 * relevant holidays, returns which entries fall on a member's holiday.
 */
export function findHolidayConflicts(
  entries: { date: string; memberId: number }[],
  groupMembers: { id: number; name: string; userId: string | null }[],
  allHolidays: { memberId: number | null; userId: string | null; startDate: string; endDate: string }[],
): HolidayConflict[] {
  if (entries.length === 0) return [];

  const memberMap = new Map(groupMembers.map((m) => [m.id, m]));

  const memberHolidays = new Map<number, { start: string; end: string }[]>();
  for (const h of allHolidays) {
    const range = { start: h.startDate, end: h.endDate };

    if (h.memberId != null) {
      const list = memberHolidays.get(h.memberId) ?? [];
      list.push(range);
      memberHolidays.set(h.memberId, list);
    }

    if (h.userId != null) {
      for (const m of groupMembers) {
        if (m.userId === h.userId) {
          const list = memberHolidays.get(m.id) ?? [];
          list.push(range);
          memberHolidays.set(m.id, list);
        }
      }
    }
  }

  const conflicts: HolidayConflict[] = [];
  for (const entry of entries) {
    const ranges = memberHolidays.get(entry.memberId);
    if (!ranges) continue;
    const onHoliday = ranges.some(
      (r) => entry.date >= r.start && entry.date <= r.end
    );
    if (onHoliday) {
      conflicts.push({
        date: entry.date,
        memberId: entry.memberId,
        memberName: memberMap.get(entry.memberId)?.name ?? "Desconocido",
      });
    }
  }

  return conflicts;
}

/**
 * Load the holidays that could conflict with a date range for a group.
 *
 * Scoped by joining back to the group's members (rather than by ids taken from
 * a previous query) so this can run in parallel with the rest of a page's
 * loading, and bounded by the range so it never scans a member's whole
 * holiday history to check a single month.
 */
export async function loadConflictingHolidays(
  groupId: number,
  rangeStart: string,
  rangeEnd: string,
) {
  const groupMemberIds = db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.groupId, groupId));

  const groupUserIds = db
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNotNull(members.userId)));

  return db
    .select({
      memberId: holidays.memberId,
      userId: holidays.userId,
      startDate: holidays.startDate,
      endDate: holidays.endDate,
    })
    .from(holidays)
    .where(
      and(
        or(
          inArray(holidays.memberId, groupMemberIds),
          inArray(holidays.userId, groupUserIds),
        ),
        lte(holidays.startDate, rangeEnd),
        gte(holidays.endDate, rangeStart),
      ),
    );
}
