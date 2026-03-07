/**
 * Shared types and pure helpers for SharedScheduleView.
 * Re-exported from the main component for callers.
 */

export interface ScheduleEntry {
  id: number;
  scheduleDateId?: number;
  date: string;
  roleId: number;
  memberId: number;
  memberName: string;
  roleName: string;
}

export interface DateNote {
  id?: number;
  scheduleDateId?: number;
  date: string;
  description: string;
}

export interface ScheduleDateInfo {
  id?: number;
  date: string;
  type: "assignable" | "for_everyone";
  label?: string | null;
  note?: string | null;
  recurringEventId?: number | null;
  recurringEventLabel?: string | null;
  startTimeUtc?: string | null;
  endTimeUtc?: string | null;
  /** @deprecated */
  recurringEventStartTimeUtc?: string | null;
  /** @deprecated */
  recurringEventEndTimeUtc?: string | null;
}

export interface RoleInfo {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId?: number | null;
  isRelevant?: boolean;
}

export interface ScheduleNavLink {
  month: number;
  year: number;
}

export interface HolidayConflict {
  date: string;
  memberId: number;
  memberName: string;
}

export interface SharedScheduleData {
  groupName?: string;
  calendarExportEnabled?: boolean;
  month: number;
  year: number;
  entries: ScheduleEntry[];
  members: { id: number; name: string }[];
  notes: DateNote[];
  scheduleDates?: ScheduleDateInfo[];
  /** @deprecated */
  forEveryoneDates?: string[];
  /** @deprecated */
  leaderRoleId?: number | null;
  dependentRoleIds?: number[];
  roles?: RoleInfo[];
  prevSchedule?: ScheduleNavLink | null;
  nextSchedule?: ScheduleNavLink | null;
  holidayConflicts?: HolidayConflict[];
  /** @deprecated */
  extraDates?: { date: string; type: string }[];
}

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function groupDatesByWeek(
  dates: string[]
): { weekNumber: number; dates: string[] }[] {
  const weekMap = new Map<number, string[]>();
  for (const date of dates) {
    const dayOfMonth = parseInt(date.slice(8, 10), 10);
    const weekNum = Math.ceil(dayOfMonth / 7);
    if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
    weekMap.get(weekNum)!.push(date);
  }
  return [...weekMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, dates]) => ({ weekNumber, dates }));
}

export function groupScheduleDatesByWeek(
  scheduleDates: ScheduleDateInfo[]
): { weekNumber: number; scheduleDates: ScheduleDateInfo[] }[] {
  const weekMap = new Map<number, ScheduleDateInfo[]>();
  for (const sd of scheduleDates) {
    const dayOfMonth = parseInt(sd.date.slice(8, 10), 10);
    const weekNum = Math.ceil(dayOfMonth / 7);
    if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
    weekMap.get(weekNum)!.push(sd);
  }
  return [...weekMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, scheduleDates]) => ({ weekNumber, scheduleDates }));
}

export function getWeekDateRange(
  year: number,
  month: number,
  weekNumber: number
): { start: string; end: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = Math.min(weekNumber * 7, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-${pad(startDay)}`,
    end: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

export function getRelativeLabel(
  targetStr: string,
  todayStr: string,
  t: (key: string, values?: { n?: number }) => string
): string {
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const [dy, dm, dd] = targetStr.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const targetDate = new Date(dy, dm - 1, dd);
  const diffMs = targetDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays === 2) return t("dayAfterTomorrow");
  if (diffDays <= 6) return t("inDays", { n: diffDays });
  if (diffDays <= 13) return t("nextWeek");
  const weeks = Math.floor(diffDays / 7);
  return t("inWeeks", { n: weeks });
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
