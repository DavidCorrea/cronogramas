import { db } from "./db";
import { holidays, members } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";

export interface HolidayConflict {
  date: string;
  memberId: number;
  memberName: string;
}

/**
 * Find schedule entries where the assigned member is on holiday.
 * Checks both member-scoped holidays (by memberId) and
 * user-scoped holidays (by userId for linked members).
 */
export async function getHolidayConflicts(
  entries: { date: string; memberId: number }[],
  groupId: number
): Promise<HolidayConflict[]> {
  if (entries.length === 0) return [];

  const memberIds = [...new Set(entries.map((e) => e.memberId))];

  const groupMembers = await db
    .select({ id: members.id, name: members.name, userId: members.userId })
    .from(members)
    .where(eq(members.groupId, groupId));

  const memberMap = new Map(groupMembers.map((m) => [m.id, m]));

  const linkedUserIds = groupMembers
    .filter((m) => m.userId != null && memberIds.includes(m.id))
    .map((m) => m.userId!);

  const conditions = [];
  if (memberIds.length > 0) {
    conditions.push(inArray(holidays.memberId, memberIds));
  }
  if (linkedUserIds.length > 0) {
    conditions.push(inArray(holidays.userId, linkedUserIds));
  }
  if (conditions.length === 0) return [];

  const allHolidays = await db
    .select()
    .from(holidays)
    .where(or(...conditions));

  // Build per-member holiday ranges
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
