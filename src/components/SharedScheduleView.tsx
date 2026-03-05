"use client";

/* eslint-disable react-hooks/preserve-manual-memoization -- Dependencies are derived arrays (e.g. .filter()); compiler flags them as potentially mutable but they are not. */
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  formatDateLong,
  formatDateWeekdayDay,
  formatDateRange,
  getWeekdayName,
} from "@/lib/timezone-utils";

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
  /** Current label from the linked recurring event (when recurringEventId is set). */
  recurringEventLabel?: string | null;
  /** Event time window: from schedule date (or linked recurring event). UTC HH:MM. */
  startTimeUtc?: string | null;
  endTimeUtc?: string | null;
  /** @deprecated Use startTimeUtc/endTimeUtc from schedule date instead. */
  recurringEventStartTimeUtc?: string | null;
  /** @deprecated Use startTimeUtc/endTimeUtc from schedule date instead. */
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
  /** When true, "Guardar en calendario" is allowed for this group (and only when one member is selected). */
  calendarExportEnabled?: boolean;
  month: number;
  year: number;
  entries: ScheduleEntry[];
  members: { id: number; name: string }[];
  notes: DateNote[];
  /** Unified schedule dates (replaces rehearsalDates + extraDates). */
  scheduleDates?: ScheduleDateInfo[];
  /** @deprecated Use scheduleDates with type 'for_everyone' instead */
  rehearsalDates?: string[];
  /** @deprecated Use scheduleDates instead */
  leaderRoleId?: number | null;
  dependentRoleIds?: number[];
  roles?: RoleInfo[];
  prevSchedule?: ScheduleNavLink | null;
  nextSchedule?: ScheduleNavLink | null;
  holidayConflicts?: HolidayConflict[];
  /** @deprecated Use scheduleDates instead */
  extraDates?: { date: string; type: string }[];
}

const MONTH_NAMES = [
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

/** Group dates by week of month (Semana 1 = days 1-7, etc.). */
function groupDatesByWeek(dates: string[]): { weekNumber: number; dates: string[] }[] {
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

/** Group schedule dates by week of month (one row per event). */
function groupScheduleDatesByWeek(
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

/** Full calendar date range for a week of the month (independent of filters). Week 1 = days 1-7, week 2 = 8-14, etc. */
function getWeekDateRange(year: number, month: number, weekNumber: number): { start: string; end: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = Math.min(weekNumber * 7, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-${pad(startDay)}`,
    end: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

/**
 * Get a friendly relative label in Spanish for the distance between today and a target date.
 * Uses user's local date for today and target.
 */
function getRelativeLabel(
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

/**
 * Get today's date as YYYY-MM-DD in user's local timezone.
 */
function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function SharedScheduleView({
  schedule,
  basePath = "/shared",
  slug: _slug,
}: {
  schedule: SharedScheduleData;
  basePath?: string;
  slug?: string;
}) {
  const t = useTranslations("cronograma");
  const searchParams = useSearchParams();
  const calendarResult = searchParams.get("calendar");
  const [filteredMemberId, setFilteredMemberId] = useState<number | null>(null);
  const [filteredRoleId, setFilteredRoleId] = useState<number | null>(null);
  const [today, setToday] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [showPastDates, setShowPastDates] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    queueMicrotask(() => setToday(getTodayISO()));
  }, []);

  useEffect(() => {
    queueMicrotask(() => setCurrentTime(Date.now()));
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    queueMicrotask(() => setSelectedDateForModal(null));
  }, [filteredMemberId]);

  // Support both old leaderRoleId (single) and new dependentRoleIds (array)
  const dependentRoleIds: number[] = schedule.dependentRoleIds
    ?? (schedule.leaderRoleId ? [schedule.leaderRoleId] : []);
  const dependentRoleIdSet = new Set(dependentRoleIds);

  // Relevant role IDs for highlighting
  const relevantRoleIdSet = new Set(
    (schedule.roles ?? []).filter((r) => r.isRelevant).map((r) => r.id)
  );

  const entryDates = [...new Set(schedule.entries.map((e) => e.date))];
  const scheduleDateList = useMemo(
    () => schedule.scheduleDates ?? [],
    [schedule.scheduleDates]
  );
  const scheduleDateByDateMap = new Map<string, ScheduleDateInfo>();
  for (const d of scheduleDateList) {
    if (!scheduleDateByDateMap.has(d.date)) scheduleDateByDateMap.set(d.date, d);
  }

  /** Display label for a schedule date: recurring event label when linked, else stored label, else default. */
  const getDateDisplayLabel = (sd: ScheduleDateInfo): string => {
    const label = sd.recurringEventLabel ?? sd.label ?? null;
    if (label) return label;
    return sd.type === "for_everyone" ? t("defaultRehearsalLabel") : t("defaultEventLabel");
  };

  /** Format event time range in local time (e.g. "14:00 – 16:00"). Returns null if no times. */
  const getDateDisplayTimeRange = (sd: ScheduleDateInfo): string | null => {
    const startUtc = sd.startTimeUtc ?? sd.recurringEventStartTimeUtc;
    const endUtc = sd.endTimeUtc ?? sd.recurringEventEndTimeUtc;
    if (!startUtc || !endUtc) return null;
    const parseHHMM = (s: string) => {
      const parts = s.split(":").map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0];
    };
    const [y, mo, day] = sd.date.split("-").map(Number);
    const [sh, sm] = parseHHMM(startUtc);
    const [eh, em] = parseHHMM(endUtc);
    const startDate = new Date(Date.UTC(y, mo - 1, day, sh, sm, 0));
    const endDate = new Date(Date.UTC(y, mo - 1, day, eh, em, 0));
    const start = startDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
    const end = endDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${start} – ${end}`;
  };

  const isDateVisible = (d: string): boolean => {
    if (!showPastDates && today && d < today) return false;
    if (dayFilter && getWeekdayName(d) !== dayFilter) return false;
    return true;
  };
  const isPast = (date: string): boolean => {
    if (!today) return false;
    return date < today;
  };

  // Schedule dates that are visible (respecting day filter and hiding events that have already ended).
  const visibleScheduleDates = useMemo(() => {
    if (scheduleDateList.length === 0 || scheduleDateList.every((d) => d.id == null)) return [];
    const now = currentTime;
    const list = scheduleDateList.filter((sd) => {
      if (!showPastDates && today && sd.date < today) return false;
      if (dayFilter && getWeekdayName(sd.date) !== dayFilter) return false;
      if (showPastDates) return true;
      const endUtc = sd.endTimeUtc ?? sd.recurringEventEndTimeUtc ?? "23:59";
      const [h, m] = endUtc.split(":").map(Number);
      const endMs = new Date(`${sd.date}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00.000Z`).getTime();
      return endMs >= now;
    });
    return [...list].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.startTimeUtc ?? "00:00").localeCompare(b.startTimeUtc ?? "00:00");
    });
  }, [scheduleDateList, showPastDates, dayFilter, today, currentTime]);

  // Use scheduleDates as source of truth when present; only show dates that have at least one non-passed event.
  const allDates = (
    scheduleDateList.length > 0
      ? [...new Set(visibleScheduleDates.map((d) => d.date))].sort()
      : [
          ...new Set([
            ...entryDates,
            ...(schedule.rehearsalDates ?? []),
            ...((schedule.extraDates ?? []).map((d) => d.date)),
          ]),
        ]
          .sort()
          .filter(isDateVisible)
  );

  // Filter entries by member and/or role
  const filteredEntries = schedule.entries.filter((e) => {
    if (filteredMemberId && e.memberId !== filteredMemberId) return false;
    if (filteredRoleId && e.roleId !== filteredRoleId) return false;
    return true;
  });

  const hasActiveFilter = filteredMemberId || filteredRoleId;

  const filteredDates = hasActiveFilter
    ? [...new Set(filteredEntries.map((e) => e.date))].sort().filter(isDateVisible)
    : allDates;

  // Derive unique weekday names from all schedule dates (for the day filter dropdown)
  const allScheduleDates =
    scheduleDateList.length > 0
      ? [...scheduleDateList.map((d) => d.date)].sort()
      : [
          ...new Set([
            ...entryDates,
            ...(schedule.rehearsalDates ?? []),
            ...((schedule.extraDates ?? []).map((d) => d.date)),
          ]),
        ].sort();
  const weekdayOrder = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const availableWeekdays = [...new Set(allScheduleDates.map(getWeekdayName))]
    .sort((a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b));

  // Use all roles from the schedule so assignable dates show every role column (including empty slots)
  const roleOrder: { id: number; name: string }[] = schedule.roles
    ? [...schedule.roles]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((r) => ({ id: r.id, name: r.name }))
    : (() => {
        const order: { id: number; name: string }[] = [];
        for (const entry of schedule.entries) {
          if (!order.find((r) => r.id === entry.roleId)) {
            order.push({ id: entry.roleId, name: entry.roleName });
          }
        }
        return order;
      })();

  const selectedMember = schedule.members.find(
    (m) => m.id === filteredMemberId
  );

  const noteMap = new Map(schedule.notes.map((n) => [n.date, n.description]));
  const noteMapByScheduleDateId = new Map(
    schedule.notes
      .filter((n) => (n as { scheduleDateId?: number }).scheduleDateId != null)
      .map((n) => [(n as { scheduleDateId: number }).scheduleDateId, n.description])
  );
  const getNoteForScheduleDate = (sd: ScheduleDateInfo): string | undefined =>
    (sd.id != null ? noteMapByScheduleDateId.get(sd.id) : undefined) ?? noteMap.get(sd.date);

  const filteredScheduleDates = useMemo(() => {
    if (visibleScheduleDates.length === 0) return [];
    if (!hasActiveFilter) return visibleScheduleDates;
    return visibleScheduleDates.filter((sd) =>
      filteredEntries.some(
        (e) =>
          e.date === sd.date &&
          (e.scheduleDateId == null || e.scheduleDateId === sd.id)
      )
    );
  }, [visibleScheduleDates, hasActiveFilter, filteredEntries]);

  const rehearsalSet = new Set(
    schedule.scheduleDates
      ? scheduleDateList.filter((d) => String(d.type).toLowerCase() === "for_everyone").map((d) => d.date)
      : (schedule.rehearsalDates ?? [])
  );
  const conflictSet = new Set(
    (schedule.holidayConflicts ?? []).map((c) => `${c.date}-${c.memberId}`)
  );
  const hasConflict = (date: string, memberId: number) =>
    conflictSet.has(`${date}-${memberId}`);

  // Helper: check if the filtered member has a dependent role on a given date
  const hasDependentRoleOnDate = (date: string): boolean => {
    if (!filteredMemberId || dependentRoleIdSet.size === 0) return false;
    return filteredEntries.some(
      (e) => e.date === date && dependentRoleIdSet.has(e.roleId)
    );
  };

  // Helper: check if the filtered member has a relevant role on a given date
  const hasRelevantRoleOnDate = (date: string): boolean => {
    if (!filteredMemberId || relevantRoleIdSet.size === 0) return false;
    return filteredEntries.some(
      (e) => e.date === date && relevantRoleIdSet.has(e.roleId)
    );
  };

  // Helper: get the dependent role names assigned to the filtered member on a date
  const getDependentRoleNamesOnDate = (date: string): string[] => {
    if (!filteredMemberId) return [];
    return filteredEntries
      .filter((e) => e.date === date && dependentRoleIdSet.has(e.roleId))
      .map((e) => e.roleName);
  };

  // Helper: get non-dependent roles for the filtered member on a date
  const getNonDependentRolesForDate = (date: string): string => {
    const dateEntries = filteredEntries.filter(
      (e) => e.date === date && !dependentRoleIdSet.has(e.roleId)
    );
    return dateEntries.map((e) => e.roleName).join(", ");
  };

  // Count non-rehearsal dates for filtered member
  const assignedDateCount = filteredMemberId
    ? filteredDates.filter((d) => !rehearsalSet.has(d)).length
    : 0;

  // Upcoming assignment for filtered member
  const upcomingDate =
    filteredMemberId && today
      ? filteredDates.find((d) => d >= today && !rehearsalSet.has(d))
      : null;

  // Dates to display in the list (exclude the upcoming date to avoid duplication)
  const displayDates = upcomingDate
    ? filteredDates.filter((d) => d !== upcomingDate)
    : filteredDates;

  const displayScheduleDates = useMemo(
    () =>
      upcomingDate
        ? filteredScheduleDates.filter((sd) => sd.date !== upcomingDate)
        : filteredScheduleDates,
    [upcomingDate, filteredScheduleDates]
  );
  const tableScheduleDates = filteredScheduleDates;

  // List view: group dates by week of month for collapsible sections
  const tableDates = filteredRoleId ? filteredDates : allDates;
  const displayDatesByWeek = useMemo(
    () => groupDatesByWeek(displayDates),
    [displayDates]
  );
  const tableDatesByWeek = useMemo(
    () => groupDatesByWeek(tableDates),
    [tableDates]
  );
  const displayScheduleDatesByWeek = useMemo(
    () => groupScheduleDatesByWeek(displayScheduleDates),
    [displayScheduleDates]
  );
  const tableScheduleDatesByWeek = useMemo(
    () => groupScheduleDatesByWeek(tableScheduleDates),
    [tableScheduleDates]
  );

  const useScheduleDateRows = visibleScheduleDates.length > 0;

  const getEntriesForScheduleDate = (sd: ScheduleDateInfo) =>
    filteredEntries.filter(
      (e) =>
        e.date === sd.date &&
        (e.scheduleDateId == null || e.scheduleDateId === sd.id)
    );

  // Collapsed week sections (only in list view); default: expand only week containing today
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());
  const initialCollapseKeyRef = useRef<string | null>(null);
  const toggleWeek = useCallback((weekNumber: number) => {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  }, []);

  useEffect(() => {
    if (viewMode !== "list") return;
    const byWeek = filteredMemberId ? displayDatesByWeek : tableDatesByWeek;
    const byWeekSd = filteredMemberId ? displayScheduleDatesByWeek : tableScheduleDatesByWeek;
    const weekData = useScheduleDateRows ? byWeekSd : byWeek;
    if (weekData.length === 0) return;
    const key = `${schedule.year}-${schedule.month}-${filteredMemberId ?? "all"}-${filteredRoleId ?? "all"}-${useScheduleDateRows}`;
    if (initialCollapseKeyRef.current === key) return;
    initialCollapseKeyRef.current = key;
    const todayStr = getTodayISO();
    const weekWithToday = useScheduleDateRows
      ? (weekData as { weekNumber: number; scheduleDates: ScheduleDateInfo[] }[]).find((w) =>
          w.scheduleDates.some((sd) => sd.date === todayStr)
        )?.weekNumber
      : (weekData as { weekNumber: number; dates: string[] }[]).find((w) => w.dates.includes(todayStr))?.weekNumber;
    const allWeekNumbers = weekData.map((w) => w.weekNumber);
    const toCollapse = weekWithToday != null
      ? allWeekNumbers.filter((n) => n !== weekWithToday)
      : allWeekNumbers;
    queueMicrotask(() => setCollapsedWeeks(new Set(toCollapse)));
  }, [viewMode, schedule.year, schedule.month, filteredMemberId, filteredRoleId, displayDatesByWeek, tableDatesByWeek, displayScheduleDatesByWeek, tableScheduleDatesByWeek, useScheduleDateRows]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-14 z-10 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {schedule.prevSchedule ? (
              <a
                href={`${basePath}/${schedule.prevSchedule.year}/${schedule.prevSchedule.month}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ←
              </a>
            ) : (
              <span className="text-sm text-muted-foreground/40 cursor-default">←</span>
            )}
            <div className="text-center">
              {schedule.groupName && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{schedule.groupName}</p>
              )}
              <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl uppercase">
                {MONTH_NAMES[schedule.month - 1]} {schedule.year}
              </h1>
            </div>
            {schedule.nextSchedule ? (
              <a
                href={`${basePath}/${schedule.nextSchedule.year}/${schedule.nextSchedule.month}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                →
              </a>
            ) : (
              <span className="text-sm text-muted-foreground/40 cursor-default">→</span>
            )}
          </div>

          <div className="border-t border-border mt-3 sm:hidden -mx-4" />

          {/* Filters + view mode row */}
          <div className="mt-3 flex items-start justify-between gap-3">
            {/* Mobile: filters toggle + view mode side by side */}
            <button
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="sm:hidden flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {(() => {
                const count = [filteredMemberId, filteredRoleId, dayFilter, showPastDates].filter(Boolean).length;
                return count > 0 ? `${t("filters")} (${count})` : t("filters");
              })()}
              <svg className={`w-3.5 h-3.5 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Desktop: filters inline */}
            <div className="hidden sm:flex flex-row gap-2 items-center flex-wrap">
              <select
                value={filteredMemberId ?? ""}
                onChange={(e) =>
                  setFilteredMemberId(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                className="rounded-md border border-border bg-transparent px-3.5 py-2 text-sm"
              >
                <option value="">{t("allPeople")}</option>
                {schedule.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={filteredRoleId ?? ""}
                onChange={(e) =>
                  setFilteredRoleId(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                className="rounded-md border border-border bg-transparent px-3.5 py-2 text-sm"
              >
                <option value="">{t("allRoles")}</option>
                {roleOrder.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {viewMode === "list" && (
                <>
                  <select
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                    className="rounded-md border border-border bg-transparent px-3.5 py-2 text-sm"
                  >
                    <option value="">{t("allDays")}</option>
                    {availableWeekdays.map((day) => (
                      <option key={day} value={day}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPastDates}
                      onChange={(e) => setShowPastDates(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-muted-foreground">{t("showPastDates")}</span>
                  </label>
                </>
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-2 shrink-0">
            <div className="flex w-fit rounded-lg border border-border p-0.5 shrink-0">
              <button
                onClick={() => { setViewMode("list"); setDayFilter(""); setShowPastDates(false); }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("list")}
              </button>
              <button
                onClick={() => { setViewMode("calendar"); setDayFilter(""); setShowPastDates(false); }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === "calendar"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("calendar")}
              </button>
            </div>
            </div>
          </div>

          {calendarResult === "success" && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400" role="status">
              {t("saveInCalendarSuccess")}
            </p>
          )}
          {calendarResult === "error" && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {t("saveInCalendarError")}
            </p>
          )}

          {/* Mobile: collapsible filters */}
          {mobileFiltersOpen && (
            <div className="sm:hidden mt-3 flex flex-col gap-2">
              <select
                value={filteredMemberId ?? ""}
                onChange={(e) =>
                  setFilteredMemberId(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                className="w-full rounded-md border border-border bg-transparent px-3.5 py-2 text-sm"
              >
                <option value="">{t("allPeople")}</option>
                {schedule.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={filteredRoleId ?? ""}
                onChange={(e) =>
                  setFilteredRoleId(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                className="w-full rounded-md border border-border bg-transparent px-3.5 py-2 text-sm"
              >
                <option value="">{t("allRoles")}</option>
                {roleOrder.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {viewMode === "list" && (
                <>
                  <select
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                    className="w-full rounded-md border border-border bg-transparent px-3.5 py-2 text-sm"
                  >
                    <option value="">{t("allDays")}</option>
                    {availableWeekdays.map((day) => (
                      <option key={day} value={day}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPastDates}
                      onChange={(e) => setShowPastDates(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-muted-foreground">{t("showPastDates")}</span>
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Mobile: merged summary card (Agenda + upcoming) */}
        {filteredMemberId && selectedMember && (
          <div className="mb-8 border border-foreground/20 rounded-md p-5 lg:hidden">
            <h2 className="text-lg font-medium">
              {t("agendaOf", { name: selectedMember.name })}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {assignedDateCount}{" "}
              {assignedDateCount === 1 ? t("dateAssigned") : t("datesAssigned")}
            </p>
            {upcomingDate && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                  {t("nextAssignment")}
                </h3>
                <p className="font-medium">
                  {formatDateLong(upcomingDate)}
                  {today && (
                    <span className="ml-2 text-sm text-muted-foreground font-normal">
                      — {getRelativeLabel(upcomingDate, today, t)}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getNonDependentRolesForDate(upcomingDate)}
                  {hasDependentRoleOnDate(upcomingDate) && (
                    <span className="ml-2 text-foreground font-medium">
                      ★ {getDependentRoleNamesOnDate(upcomingDate).join(", ")}
                    </span>
                  )}
                </p>
                {upcomingDate && getNoteForScheduleDate(scheduleDateByDateMap.get(upcomingDate) ?? { date: upcomingDate, type: "assignable" }) && (
                  <p className="text-xs text-accent mt-2">
                    {getNoteForScheduleDate(scheduleDateByDateMap.get(upcomingDate) ?? { date: upcomingDate, type: "assignable" })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Desktop: separate header + upcoming card */}
        {filteredMemberId && selectedMember && (
          <div className="hidden lg:block">
            <div className="mb-8 border-b border-border pb-6">
              <h2 className="text-lg font-medium">
                {t("agendaOf", { name: selectedMember.name })}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {assignedDateCount}{" "}
                {assignedDateCount === 1 ? t("dateAssigned") : t("datesAssigned")}
              </p>
            </div>
            {upcomingDate && (
              <div className="mb-8 border border-foreground/20 rounded-md p-5">
                <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
                  {t("nextAssignment")}
                </h3>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium">
                    {formatDateLong(upcomingDate)}
                    {today && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        — {getRelativeLabel(upcomingDate, today, t)}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getNonDependentRolesForDate(upcomingDate)}
                    {hasDependentRoleOnDate(upcomingDate) && (
                      <span className="ml-2 text-foreground font-medium">
                        ★ {getDependentRoleNamesOnDate(upcomingDate).join(", ")}
                      </span>
                    )}
                  </span>
                </div>
                {upcomingDate && getNoteForScheduleDate(scheduleDateByDateMap.get(upcomingDate) ?? { date: upcomingDate, type: "assignable" }) && (
                  <p className="text-xs text-accent mt-2">
                    {getNoteForScheduleDate(scheduleDateByDateMap.get(upcomingDate) ?? { date: upcomingDate, type: "assignable" })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile card view (list mode: weekly sections) */}
        <div className={`lg:hidden space-y-8 ${viewMode !== "list" ? "hidden" : ""}`}>
          {useScheduleDateRows
            ? displayScheduleDatesByWeek.map(({ weekNumber, scheduleDates }) => {
                const isCollapsed = collapsedWeeks.has(weekNumber);
                return (
                  <section
                    key={weekNumber}
                    className="border border-border rounded-lg bg-muted/10 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleWeek(weekNumber)}
                      className="w-full px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
                      aria-expanded={!isCollapsed}
                    >
                      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {t("week")} {weekNumber}
                        <span className="normal-case font-normal tracking-normal text-muted-foreground/90">
                          {" · "}
                          {formatDateRange(
                            getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
                            getWeekDateRange(schedule.year, schedule.month, weekNumber).end
                          )}
                        </span>
                      </h2>
                      <span className="text-muted-foreground shrink-0" aria-hidden>{isCollapsed ? "▶" : "▼"}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {scheduleDates.map((sd) => {
                          const isRehearsal = sd.type === "for_everyone";
                          const entriesOnSd = getEntriesForScheduleDate(sd);
                          const depRoleDate = filteredMemberId && entriesOnSd.some((e) => dependentRoleIdSet.has(e.roleId));
                          const relevantRoleDate = filteredMemberId && entriesOnSd.some((e) => relevantRoleIdSet.has(e.roleId));
                          const highlighted = depRoleDate || relevantRoleDate;
                          const note = getNoteForScheduleDate(sd);
                          return (
                            <div key={sd.id ?? sd.date}>
                              {isRehearsal ? (
                                <button
                                  type="button"
                                  className={`w-full text-left px-4 py-3.5 text-sm ${isPast(sd.date) ? "opacity-50" : ""}`}
                                  onClick={() => setSelectedDateForModal(sd.date)}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{formatDateWeekdayDay(sd.date)}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground italic shrink-0">{getDateDisplayLabel(sd) || "Ensayo"}</span>
                                      <span className="text-xs text-muted-foreground shrink-0" aria-hidden>▸</span>
                                    </div>
                                  </div>
                                  {getDateDisplayTimeRange(sd) && <p className="text-xs text-muted-foreground mt-0.5">{getDateDisplayTimeRange(sd)}</p>}
                                  {note && <p className="text-xs text-accent mt-1">{note}</p>}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`w-full text-left transition-all ${isPast(sd.date) ? "opacity-50" : ""} ${highlighted ? "bg-muted/30" : ""}`}
                                  onClick={() => setSelectedDateForModal(sd.date)}
                                >
                                  <div className="px-4 py-3.5 text-sm">
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">{formatDateWeekdayDay(sd.date)}</span>
                                        {getDateDisplayLabel(sd) && (
                                          <>
                                            <span className="text-xs text-muted-foreground italic">{getDateDisplayLabel(sd)}</span>
                                            {getDateDisplayTimeRange(sd) && <span className="text-xs text-muted-foreground">{getDateDisplayTimeRange(sd)}</span>}
                                          </>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {depRoleDate && filteredMemberId && (
                                          <span className="text-xs font-medium">★ {entriesOnSd.filter((e) => dependentRoleIdSet.has(e.roleId)).map((e) => e.roleName).join(", ")}</span>
                                        )}
                                        <span className="text-xs text-muted-foreground shrink-0" aria-hidden>▸</span>
                                      </div>
                                    </div>
                                    {note && <p className="text-xs text-accent mt-1">{note}</p>}
                                  </div>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            : displayDatesByWeek.map(({ weekNumber, dates }) => {
            const isCollapsed = collapsedWeeks.has(weekNumber);
            return (
              <section
                key={weekNumber}
                className="border border-border rounded-lg bg-muted/10 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleWeek(weekNumber)}
                  className="w-full px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {t("week")} {weekNumber}
                    <span className="normal-case font-normal tracking-normal text-muted-foreground/90">
                      {" · "}
                      {formatDateRange(
                        getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
                        getWeekDateRange(schedule.year, schedule.month, weekNumber).end
                      )}
                    </span>
                  </h2>
                  <span className="text-muted-foreground shrink-0" aria-hidden>
                    {isCollapsed ? "▶" : "▼"}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {dates.map((date) => {
                      const sd = scheduleDateByDateMap.get(date) ?? { date, type: "assignable" as const };
                      const isRehearsal = rehearsalSet.has(date);
                      const depRoleDate = hasDependentRoleOnDate(date);
                      const relevantRoleDate = hasRelevantRoleOnDate(date);
                      const highlighted = filteredMemberId && (depRoleDate || relevantRoleDate);

                      return (
                        <div key={date}>
                          {isRehearsal ? (
                            <button
                              type="button"
                              className={`w-full text-left px-4 py-3.5 text-sm ${
                                isPast(date) ? "opacity-50" : ""
                              }`}
                              onClick={() => setSelectedDateForModal(date)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{formatDateWeekdayDay(date)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground italic shrink-0">
                                    {getDateDisplayLabel(sd) || "Ensayo"}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0" aria-hidden>
                                    ▸
                                  </span>
                                </div>
                              </div>
                              {getDateDisplayTimeRange(sd) && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {getDateDisplayTimeRange(sd)}
                                </p>
                              )}
                              {getNoteForScheduleDate(sd) && (
                                <p className="text-xs text-accent mt-1">{getNoteForScheduleDate(sd)}</p>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`w-full text-left transition-all ${
                                isPast(date) ? "opacity-50" : ""
                              } ${highlighted ? "bg-muted/30" : ""}`}
                              onClick={() => setSelectedDateForModal(date)}
                            >
                              <div className="px-4 py-3.5 text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">{formatDateWeekdayDay(date)}</span>
                                    {getDateDisplayLabel(sd) && (
                                      <>
                                        <span className="text-xs text-muted-foreground italic">
                                          {getDateDisplayLabel(sd)}
                                        </span>
                                        {getDateDisplayTimeRange(sd) && (
                                          <span className="text-xs text-muted-foreground">
                                            {getDateDisplayTimeRange(sd)}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {depRoleDate && filteredMemberId && (
                                      <span className="text-xs font-medium">
                                        ★ {getDependentRoleNamesOnDate(date).join(", ")}
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground shrink-0" aria-hidden>
                                      ▸
                                    </span>
                                  </div>
                                </div>
                                {getNoteForScheduleDate(sd) && (
                                  <p className="text-xs text-accent mt-1">{getNoteForScheduleDate(sd)}</p>
                                )}
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        }
        </div>

        {/* Calendar grid view */}
        {viewMode === "calendar" && (() => {
          const year = schedule.year;
          const month = schedule.month;
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const firstDayDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
          const leadingBlanks = firstDayDow === 0 ? 6 : firstDayDow - 1;

          const allAssignmentDates = new Set(entryDates);
          const filteredDateSet = new Set(filteredDates);
          const calDayHeaders = ["L", "M", "X", "J", "V", "S", "D"];

          return (
            <div className="max-w-md mx-auto mb-10">
              <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-4">
                {t("calendar")}
              </h2>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {calDayHeaders.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-muted-foreground py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const hasAnyAssignment = allAssignmentDates.has(dateStr);
                  const matchesFilter = filteredDateSet.has(dateStr);
                  const isRehearsalDay = rehearsalSet.has(dateStr);
                  const isToday = dateStr === today;
                  const past = isPast(dateStr);
                  const hasContent = hasAnyAssignment || isRehearsalDay;
                  const dimmed = hasActiveFilter && hasContent && !matchesFilter;
                  const isHighlighted = filteredMemberId != null && (hasDependentRoleOnDate(dateStr) || hasRelevantRoleOnDate(dateStr));

                  return (
                    <button
                      key={dayNum}
                      onClick={() => {
                        if (hasContent) setSelectedDateForModal(dateStr);
                      }}
                      disabled={!hasContent}
                      className={[
                        "aspect-square rounded-md flex items-center justify-center text-sm transition-colors relative",
                        past ? "opacity-50" : "",
                        isToday ? "ring-1 ring-foreground" : "",
                        dimmed
                          ? "opacity-30"
                          : isHighlighted
                            ? "bg-foreground/15 font-semibold"
                            : hasAnyAssignment
                              ? "bg-muted/50 font-medium"
                              : isRehearsalDay
                                ? "border border-dashed border-border"
                                : "text-muted-foreground",
                        hasContent ? "cursor-pointer hover:bg-muted/70 active:bg-muted" : "cursor-default",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {dayNum}
                      {isHighlighted && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Desktop table view (list mode: weekly sections) */}
        <div className={`hidden lg:block overflow-x-auto space-y-8 ${viewMode !== "list" ? "!hidden" : ""}`}>
          {filteredMemberId ? (
            // Simplified table for individual member, grouped by week
            displayDatesByWeek.map(({ weekNumber, dates }) => {
              const isCollapsed = collapsedWeeks.has(weekNumber);
              return (
                <section key={weekNumber} className="border border-border rounded-lg overflow-hidden bg-muted/5">
                  <button
                    type="button"
                    onClick={() => toggleWeek(weekNumber)}
                    className="w-full px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
                    aria-expanded={!isCollapsed}
                  >
                          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t("week")} {weekNumber}
                            <span className="normal-case font-normal tracking-normal text-muted-foreground/90">
                              {" · "}
                              {formatDateRange(
                                getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
                                getWeekDateRange(schedule.year, schedule.month, weekNumber).end
                              )}
                            </span>
                          </h2>
                    <span className="text-muted-foreground shrink-0" aria-hidden>
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            {t("date")}
                          </th>
                          <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            {t("role")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dates.map((date) => {
                          const sd = scheduleDateByDateMap.get(date) ?? { date, type: "assignable" as const };
                          const isRehearsal = rehearsalSet.has(date);
                          const note = getNoteForScheduleDate(sd);
                          const depRoleDate = hasDependentRoleOnDate(date);
                          const relevantRoleDate = hasRelevantRoleOnDate(date);
                          const highlighted = depRoleDate || relevantRoleDate;

                          return (
                            <tr
                              key={date}
                              className={[
                                "border-b border-border",
                                isRehearsal ? "bg-muted/20" : highlighted ? "bg-muted/30" : "",
                                isPast(date) ? "opacity-50" : "",
                                "hover:bg-muted/20 transition-colors",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <td
                                className={`px-4 py-4 text-sm align-middle ${
                                  highlighted ? "border-l-2 border-l-foreground" : ""
                                }`}
                              >
                                <div>
                                  <div className="font-medium">{formatDateWeekdayDay(date)}</div>
                                  {!isRehearsal && getDateDisplayLabel(sd) && (
                                    <div className="text-xs text-muted-foreground italic mt-0.5">
                                      {getDateDisplayLabel(sd)}
                                    </div>
                                  )}
                                  {!isRehearsal && getDateDisplayTimeRange(sd) && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {getDateDisplayTimeRange(sd)}
                                    </div>
                                  )}
                                  {depRoleDate && (
                                    <span className="text-xs font-medium block mt-0.5">
                                      ★ {getDependentRoleNamesOnDate(date).join(", ")}
                                    </span>
                                  )}
                                </div>
                                {note && (
                                  <div className="text-xs text-accent font-normal mt-0.5">
                                    {note}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4 text-sm align-middle">
                                {isRehearsal ? (
                                  <span className="text-muted-foreground/40">—</span>
                                ) : (() => {
                                  const dateEntries = filteredEntries.filter((e) => e.date === date);
                                  const roleNames = [...new Set(dateEntries.map((e) => e.roleName))];
                                  if (roleNames.length === 0) return <span className="text-muted-foreground/40">—</span>;
                                  return (
                                    <ul className="list-disc list-inside text-xs font-medium space-y-0.5">
                                      {roleNames.map((name) => (
                                        <li key={name}>{name}</li>
                                      ))}
                                    </ul>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })
          ) : (
            // Full schedule table, grouped by week
            (() => {
              const visibleRoles = filteredRoleId
                ? roleOrder.filter((r) => r.id === filteredRoleId)
                : roleOrder;
              return (
                <>
                  {tableDatesByWeek.map(({ weekNumber, dates }) => {
                    const isCollapsed = collapsedWeeks.has(weekNumber);
                    return (
                      <section key={weekNumber} className="border border-border rounded-lg overflow-hidden bg-muted/5">
                        <button
                          type="button"
                          onClick={() => toggleWeek(weekNumber)}
                          className="w-full px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
                          aria-expanded={!isCollapsed}
                        >
                          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            {t("week")} {weekNumber}
                            <span className="normal-case font-normal tracking-normal text-muted-foreground/90">
                              {" · "}
                              {formatDateRange(
                                getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
                                getWeekDateRange(schedule.year, schedule.month, weekNumber).end
                              )}
                            </span>
                          </h2>
                          <span className="text-muted-foreground shrink-0" aria-hidden>
                            {isCollapsed ? "▶" : "▼"}
                          </span>
                        </button>
                        {!isCollapsed && (
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                                  {t("date")}
                                </th>
                                {visibleRoles.map((role) => (
                                  <th
                                    key={role.id}
                                    className="px-4 py-4 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground"
                                  >
                                    {role.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {dates.map((date) => {
                                const sd = scheduleDateByDateMap.get(date) ?? { date, type: "assignable" as const };
                                const isRehearsal = rehearsalSet.has(date);
                                const entriesOnDate = filteredEntries.filter(
                                  (e) => e.date === date
                                );
                                const note = getNoteForScheduleDate(sd);

                                return (
                                  <tr
                                    key={date}
                                    className={[
                                      "border-b border-border",
                                      isRehearsal ? "bg-muted/20" : "",
                                      isPast(date) ? "opacity-50" : "",
                                      "hover:bg-muted/20 transition-colors",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <td className="px-4 py-4 text-sm font-medium whitespace-nowrap align-middle">
                                      <div>{formatDateWeekdayDay(date)}</div>
                                      {!isRehearsal && getDateDisplayLabel(sd) && (
                                        <div className="text-xs text-muted-foreground italic font-normal mt-0.5">
                                          {getDateDisplayLabel(sd)}
                                        </div>
                                      )}
                                      {!isRehearsal && getDateDisplayTimeRange(sd) && (
                                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                                          {getDateDisplayTimeRange(sd)}
                                        </div>
                                      )}
                                      {note && (
                                        <div className="text-xs text-accent font-normal mt-0.5">
                                          {note}
                                        </div>
                                      )}
                                    </td>
                                    {isRehearsal ? (
                                      <td
                                        colSpan={visibleRoles.length}
                                        className="px-4 py-4 text-sm text-muted-foreground italic text-center"
                                      >
                                        {getDateDisplayLabel(sd) || "Ensayo"}
                                        {getDateDisplayTimeRange(sd) && (
                                          <div className="text-xs mt-0.5 font-normal">
                                            {getDateDisplayTimeRange(sd)}
                                          </div>
                                        )}
                                      </td>
                                    ) : (
                                      visibleRoles.map((role) => {
                                        const roleEntries = entriesOnDate.filter(
                                          (e) => e.roleId === role.id
                                        );
                                        return (
                                          <td
                                            key={role.id}
                                            className="px-4 py-4 text-sm align-middle"
                                          >
                                            {roleEntries.length === 0 ? (
                                              <span className="text-muted-foreground/40">
                                                —
                                              </span>
                                            ) : roleEntries.length === 1 ? (
                                              <span className="font-medium text-xs">
                                                {roleEntries[0].memberName}
                                                {hasConflict(date, roleEntries[0].memberId) && (
                                                  <span className="text-amber-500 ml-0.5" title={t("conflictWithHolidays")}>⚠</span>
                                                )}
                                              </span>
                                            ) : (
                                              <span className="text-xs font-medium">
                                                {[...roleEntries]
                                                  .sort((a, b) => a.memberName.localeCompare(b.memberName, "es"))
                                                  .map((e, i) => (
                                                    <span key={e.id} className="inline-flex items-center gap-0.5">
                                                      {i > 0 && <span className="text-muted-foreground">, </span>}
                                                      {e.memberName}
                                                      {hasConflict(date, e.memberId) && (
                                                        <span className="text-amber-500 shrink-0" title={t("conflictWithHolidays")}>⚠</span>
                                                      )}
                                                    </span>
                                                  ))}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </section>
                    );
                  })}
                </>
              );
            })()
          )}
        </div>

        {displayDates.length === 0 && !upcomingDate && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {filteredMemberId
                ? "Este miembro no tiene asignaciones este mes."
                : hasActiveFilter
                  ? t("noAssignmentsFilter")
                  : t("noEntries")}
            </p>
          </div>
        )}
      </main>

      {selectedDateForModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSelectedDateForModal(null)}
        >
          <div
            className="bg-background border border-border rounded-lg w-full max-w-sm p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-medium capitalize">
                {formatDateLong(selectedDateForModal)}
              </h3>
              <button
                onClick={() => setSelectedDateForModal(null)}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none ml-3"
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>

            {(() => {
              const date = selectedDateForModal;
              const sd = scheduleDateByDateMap.get(date) ?? { date, type: "assignable" as const };
              const isRehearsal = rehearsalSet.has(date);
              const label = getDateDisplayLabel(sd) || (isRehearsal ? "Ensayo" : "");
              const timeRange = getDateDisplayTimeRange(sd);
              const entriesOnDate = schedule.entries.filter((e) => e.date === date);
              const roleIdsOnDate = [...new Set(entriesOnDate.map((e) => e.roleId))];
              const rolesSorted = roleIdsOnDate
                .map((roleId) => ({
                  roleId,
                  role: (schedule.roles ?? []).find((r) => r.id === roleId),
                  name: roleOrder.find((r) => r.id === roleId)?.name ?? t("role"),
                }))
                .sort((a, b) => {
                  const aRelevant = a.role?.isRelevant ? 1 : 0;
                  const bRelevant = b.role?.isRelevant ? 1 : 0;
                  if (bRelevant !== aRelevant) return bRelevant - aRelevant;
                  return (a.role?.displayOrder ?? 0) - (b.role?.displayOrder ?? 0);
                });
              const note = getNoteForScheduleDate(sd);
              const hasContent = label || timeRange || rolesSorted.length > 0 || note;

              if (!hasContent) {
                return <p className="text-sm text-muted-foreground">{t("noDetails")}</p>;
              }

              return (
                <>
                  {label ? (
                    <p className="text-sm text-muted-foreground italic">{label}</p>
                  ) : null}
                  {timeRange ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{timeRange}</p>
                  ) : null}
                  {rolesSorted.length > 0 ? (
                    <div className="mt-3 overflow-hidden rounded-md border border-border/40">
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {rolesSorted.map(({ roleId, name }) => {
                            const members = entriesOnDate
                              .filter((e) => e.roleId === roleId)
                              .map((e) => ({ name: e.memberName, hasConflict: hasConflict(date, e.memberId) }));
                            return (
                              <tr key={roleId} className="border-b border-border/40 last:border-b-0">
                                <td className="px-3 py-2 font-medium text-muted-foreground align-top">
                                  {name}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {members.length === 1 ? (
                                    <span className="flex items-center gap-1">
                                      {members[0].name}
                                      {members[0].hasConflict && (
                                        <span className="text-amber-500 shrink-0" title={t("conflictWithHolidays")}>⚠</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-sm">
                                      {[...members]
                                        .sort((a, b) => a.name.localeCompare(b.name, "es"))
                                        .map((m, i) => (
                                          <span key={i} className="inline-flex items-center gap-0.5">
                                            {i > 0 && ", "}
                                            {m.name}
                                            {m.hasConflict && (
                                              <span className="text-amber-500 shrink-0" title={t("conflictWithHolidays")}>⚠</span>
                                            )}
                                          </span>
                                        ))}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {note && (
                    <p className="text-xs text-accent mt-3 pt-3 border-t border-border/50">
                      {note}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
