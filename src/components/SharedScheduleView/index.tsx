"use client";

/* eslint-disable react-hooks/preserve-manual-memoization -- Dependencies are derived arrays (e.g. .filter()); compiler flags them as potentially mutable but they are not. */
import React, { useEffect, useState, useMemo, useRef, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  formatDateWeekdayDay,
  formatDateRange,
  getWeekdayName,
} from "@/lib/timezone-utils";
import {
  type ScheduleDateInfo,
  type SharedScheduleData,
  getTodayISO,
  getWeekDateRange,
  groupDatesByWeek,
  groupScheduleDatesByWeek,
} from "./types";
import { MonthHeader } from "./MonthHeader";
import { WeekSection } from "./WeekSection";
import { CalendarGrid } from "./CalendarGrid";
import {
  getDateDisplayLabel as getDateDisplayLabelPure,
  getDateDisplayTimeRange,
} from "./helpers";
import { MemberAgendaCard } from "./MemberAgendaCard";

const DateDetailModal = dynamic(
  () => import("./DateDetailModal").then((m) => ({ default: m.DateDetailModal })),
);

export type {
  ScheduleEntry,
  DateNote,
  ScheduleDateInfo,
  RoleInfo,
  ScheduleNavLink,
  HolidayConflict,
  SharedScheduleData,
} from "./types";

export { MONTH_NAMES } from "./types";

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
  const [, startTransition] = useTransition();
  const [filteredMemberId, setFilteredMemberId] = useState<number | null>(null);
  const [filteredRoleId, setFilteredRoleId] = useState<number | null>(null);
  const [today, setToday] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [showPastDates, setShowPastDates] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const setFilteredMemberIdTransition = useCallback(
    (id: number | null) => startTransition(() => setFilteredMemberId(id)),
    [startTransition],
  );
  const setFilteredRoleIdTransition = useCallback(
    (id: number | null) => startTransition(() => setFilteredRoleId(id)),
    [startTransition],
  );
  const setDayFilterTransition = useCallback(
    (v: string) => startTransition(() => setDayFilter(v)),
    [startTransition],
  );
  const setViewModeTransition = useCallback(
    (v: "list" | "calendar") => startTransition(() => setViewMode(v)),
    [startTransition],
  );

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

  const dependentRoleIds: number[] =
    schedule.dependentRoleIds ?? (schedule.leaderRoleId ? [schedule.leaderRoleId] : []);
  const dependentRoleIdSet = new Set(dependentRoleIds);
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

  const getDateDisplayLabel = (sd: ScheduleDateInfo) => getDateDisplayLabelPure(sd, t);

  const isDateVisible = (d: string): boolean => {
    if (!showPastDates && today && d < today) return false;
    if (dayFilter && getWeekdayName(d) !== dayFilter) return false;
    return true;
  };
  const isPast = (date: string): boolean => (today ? date < today : false);

  const visibleScheduleDates = useMemo(() => {
    if (scheduleDateList.length === 0 || scheduleDateList.every((d) => d.id == null))
      return [];
    const now = currentTime;
    const list = scheduleDateList.filter((sd) => {
      if (!showPastDates && today && sd.date < today) return false;
      if (dayFilter && getWeekdayName(sd.date) !== dayFilter) return false;
      if (showPastDates) return true;
      const endUtc = sd.endTimeUtc ?? sd.recurringEventEndTimeUtc ?? "23:59";
      const [h, m] = endUtc.split(":").map(Number);
      const endMs = new Date(
        `${sd.date}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00.000Z`
      ).getTime();
      return endMs >= now;
    });
    return [...list].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.startTimeUtc ?? "00:00").localeCompare(b.startTimeUtc ?? "00:00");
    });
  }, [scheduleDateList, showPastDates, dayFilter, today, currentTime]);

  const allDates =
    scheduleDateList.length > 0
      ? [...new Set(visibleScheduleDates.map((d) => d.date))].sort()
      : [
          ...new Set([
            ...entryDates,
            ...(schedule.forEveryoneDates ?? []),
            ...(schedule.extraDates ?? []).map((d) => d.date),
          ]),
        ]
          .sort()
          .filter(isDateVisible);

  const filteredEntries = schedule.entries.filter((entry) => {
    if (filteredMemberId && entry.memberId !== filteredMemberId) return false;
    if (filteredRoleId && entry.roleId !== filteredRoleId) return false;
    return true;
  });

  const hasActiveFilter = !!filteredMemberId || !!filteredRoleId;

  const filteredDates = hasActiveFilter
    ? [...new Set(filteredEntries.map((e) => e.date))].sort().filter(isDateVisible)
    : allDates;

  const allScheduleDates =
    scheduleDateList.length > 0
      ? [...scheduleDateList.map((d) => d.date)].sort()
      : [
          ...new Set([
            ...entryDates,
            ...(schedule.forEveryoneDates ?? []),
            ...(schedule.extraDates ?? []).map((d) => d.date),
          ]),
        ].sort();
  const weekdayOrder = [
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
    "domingo",
  ];
  const availableWeekdays = [...new Set(allScheduleDates.map(getWeekdayName))].sort(
    (a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b)
  );

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

  const selectedMember = schedule.members.find((m) => m.id === filteredMemberId);

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

  const forEveryoneSet = new Set(
    schedule.scheduleDates
      ? scheduleDateList
          .filter((d) => String(d.type).toLowerCase() === "for_everyone")
          .map((d) => d.date)
      : schedule.forEveryoneDates ?? []
  );
  const conflictSet = new Set(
    (schedule.holidayConflicts ?? []).map((c) => `${c.date}-${c.memberId}`)
  );
  const hasConflict = (date: string, memberId: number) =>
    conflictSet.has(`${date}-${memberId}`);

  const hasDependentRoleOnDate = (date: string): boolean => {
    if (!filteredMemberId || dependentRoleIdSet.size === 0) return false;
    return filteredEntries.some(
      (e) => e.date === date && dependentRoleIdSet.has(e.roleId)
    );
  };

  const hasRelevantRoleOnDate = (date: string): boolean => {
    if (!filteredMemberId || relevantRoleIdSet.size === 0) return false;
    return filteredEntries.some(
      (e) => e.date === date && relevantRoleIdSet.has(e.roleId)
    );
  };

  const getDependentRoleNamesOnDate = (date: string): string[] => {
    if (!filteredMemberId) return [];
    return filteredEntries
      .filter((e) => e.date === date && dependentRoleIdSet.has(e.roleId))
      .map((e) => e.roleName);
  };

  const getNonDependentRolesForDate = (date: string): string => {
    const dateEntries = filteredEntries.filter(
      (e) => e.date === date && !dependentRoleIdSet.has(e.roleId)
    );
    return dateEntries.map((e) => e.roleName).join(", ");
  };

  const assignedDateCount = filteredMemberId
    ? filteredDates.filter((d) => !forEveryoneSet.has(d)).length
    : 0;

  const upcomingDate =
    filteredMemberId && today
      ? filteredDates.find((d) => d >= today && !forEveryoneSet.has(d)) ?? null
      : null;

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

  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());
  const initialCollapseKeyRef = useRef<string | null>(null);

  const desktopTableRef = useRef<HTMLDivElement>(null);
  const [desktopContainerWidth, setDesktopContainerWidth] = useState(0);
  useEffect(() => {
    const el = desktopTableRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDesktopContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
    const byWeekSd = filteredMemberId
      ? displayScheduleDatesByWeek
      : tableScheduleDatesByWeek;
    const weekData = useScheduleDateRows ? byWeekSd : byWeek;
    if (weekData.length === 0) return;
    const key = `${schedule.year}-${schedule.month}-${filteredMemberId ?? "all"}-${filteredRoleId ?? "all"}-${useScheduleDateRows}`;
    if (initialCollapseKeyRef.current === key) return;
    initialCollapseKeyRef.current = key;
    const todayStr = getTodayISO();
    const weekWithToday = useScheduleDateRows
      ? (weekData as { weekNumber: number; scheduleDates: ScheduleDateInfo[] }[]).find(
          (w) => w.scheduleDates.some((sd) => sd.date === todayStr)
        )?.weekNumber
      : (weekData as { weekNumber: number; dates: string[] }[]).find((w) =>
          w.dates.includes(todayStr)
        )?.weekNumber;
    const allWeekNumbers = weekData.map((w) => w.weekNumber);
    const toCollapse =
      weekWithToday != null
        ? allWeekNumbers.filter((n) => n !== weekWithToday)
        : allWeekNumbers;
    queueMicrotask(() => setCollapsedWeeks(new Set(toCollapse)));
  }, [
    viewMode,
    schedule.year,
    schedule.month,
    filteredMemberId,
    filteredRoleId,
    displayDatesByWeek,
    tableDatesByWeek,
    displayScheduleDatesByWeek,
    tableScheduleDatesByWeek,
    useScheduleDateRows,
  ]);

  const weekDateRangeLabel = (weekNumber: number) =>
    formatDateRange(
      getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
      getWeekDateRange(schedule.year, schedule.month, weekNumber).end
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MonthHeader
        schedule={schedule}
        basePath={basePath}
        t={t}
        filteredMemberId={filteredMemberId}
        setFilteredMemberId={setFilteredMemberIdTransition}
        filteredRoleId={filteredRoleId}
        setFilteredRoleId={setFilteredRoleIdTransition}
        dayFilter={dayFilter}
        setDayFilter={setDayFilterTransition}
        showPastDates={showPastDates}
        setShowPastDates={setShowPastDates}
        viewMode={viewMode}
        setViewMode={setViewModeTransition}
        mobileFiltersOpen={mobileFiltersOpen}
        setMobileFiltersOpen={setMobileFiltersOpen}
        roleOrder={roleOrder}
        availableWeekdays={availableWeekdays}
        calendarResult={calendarResult}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {filteredMemberId && selectedMember && (
          <MemberAgendaCard
            memberName={selectedMember.name}
            assignedDateCount={assignedDateCount}
            upcomingDate={upcomingDate}
            today={today}
            getNonDependentRolesForDate={getNonDependentRolesForDate}
            hasDependentRoleOnDate={hasDependentRoleOnDate}
            getDependentRoleNamesOnDate={getDependentRoleNamesOnDate}
            getNoteForScheduleDate={getNoteForScheduleDate}
            scheduleDateByDateMap={scheduleDateByDateMap}
            t={t}
          />
        )}

        <div
          className={`lg:hidden space-y-8 ${viewMode !== "list" ? "hidden" : ""}`}
        >
          {useScheduleDateRows
            ? displayScheduleDatesByWeek.map(({ weekNumber, scheduleDates }) => (
                <WeekSection
                  key={weekNumber}
                  weekNumber={weekNumber}
                  titlePrefix={t("week")}
                  dateRangeLabel={weekDateRangeLabel(weekNumber)}
                  isCollapsed={collapsedWeeks.has(weekNumber)}
                  onToggle={() => toggleWeek(weekNumber)}
                >
                  <div className="divide-y divide-border">
                    {scheduleDates.map((sd) => {
                      const isForEveryone = sd.type === "for_everyone";
                      const entriesOnSd = getEntriesForScheduleDate(sd);
                      const depRoleDate =
                        filteredMemberId &&
                        entriesOnSd.some((e) => dependentRoleIdSet.has(e.roleId));
                      const relevantRoleDate =
                        filteredMemberId &&
                        entriesOnSd.some((e) => relevantRoleIdSet.has(e.roleId));
                      const highlighted = depRoleDate || relevantRoleDate;
                      const note = getNoteForScheduleDate(sd);
                      return (
                        <div key={sd.id ?? sd.date}>
                          {isForEveryone ? (
                            <button
                              type="button"
                              className={`w-full text-left px-4 py-3.5 text-sm ${isPast(sd.date) ? "opacity-50" : ""}`}
                              onClick={() => setSelectedDateForModal(sd.date)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {formatDateWeekdayDay(sd.date)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground italic shrink-0">
                                    {getDateDisplayLabel(sd)}
                                  </span>
                                  <span
                                    className="text-xs text-muted-foreground shrink-0"
                                    aria-hidden
                                  >
                                    ▸
                                  </span>
                                </div>
                              </div>
                              {getDateDisplayTimeRange(sd) && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {getDateDisplayTimeRange(sd)}
                                </p>
                              )}
                              {note && (
                                <p className="text-xs text-accent mt-1">{note}</p>
                              )}
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
                                    <span className="font-medium">
                                      {formatDateWeekdayDay(sd.date)}
                                    </span>
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
                                        ★{" "}
                                        {entriesOnSd
                                          .filter((e) =>
                                            dependentRoleIdSet.has(e.roleId)
                                          )
                                          .map((e) => e.roleName)
                                          .join(", ")}
                                      </span>
                                    )}
                                    <span
                                      className="text-xs text-muted-foreground shrink-0"
                                      aria-hidden
                                    >
                                      ▸
                                    </span>
                                  </div>
                                </div>
                                {note && (
                                  <p className="text-xs text-accent mt-1">
                                    {note}
                                  </p>
                                )}
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </WeekSection>
              ))
            : displayDatesByWeek.map(({ weekNumber, dates }) => (
                <WeekSection
                  key={weekNumber}
                  weekNumber={weekNumber}
                  titlePrefix={t("week")}
                  dateRangeLabel={weekDateRangeLabel(weekNumber)}
                  isCollapsed={collapsedWeeks.has(weekNumber)}
                  onToggle={() => toggleWeek(weekNumber)}
                >
                  <div className="divide-y divide-border">
                    {dates.map((date) => {
                      const sd =
                        scheduleDateByDateMap.get(date) ?? {
                          date,
                          type: "assignable" as const,
                        };
                      const isForEveryone = forEveryoneSet.has(date);
                      const depRoleDate = hasDependentRoleOnDate(date);
                      const relevantRoleDate = hasRelevantRoleOnDate(date);
                      const highlighted =
                        filteredMemberId && (depRoleDate || relevantRoleDate);
                      return (
                        <div key={date}>
                          {isForEveryone ? (
                            <button
                              type="button"
                              className={`w-full text-left px-4 py-3.5 text-sm ${isPast(date) ? "opacity-50" : ""}`}
                              onClick={() => setSelectedDateForModal(date)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {formatDateWeekdayDay(date)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground italic shrink-0">
                                    {getDateDisplayLabel(sd)}
                                  </span>
                                  <span
                                    className="text-xs text-muted-foreground shrink-0"
                                    aria-hidden
                                  >
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
                                <p className="text-xs text-accent mt-1">
                                  {getNoteForScheduleDate(sd)}
                                </p>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`w-full text-left transition-all ${isPast(date) ? "opacity-50" : ""} ${highlighted ? "bg-muted/30" : ""}`}
                              onClick={() => setSelectedDateForModal(date)}
                            >
                              <div className="px-4 py-3.5 text-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">
                                      {formatDateWeekdayDay(date)}
                                    </span>
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
                                        ★{" "}
                                        {getDependentRoleNamesOnDate(date).join(
                                          ", "
                                        )}
                                      </span>
                                    )}
                                    <span
                                      className="text-xs text-muted-foreground shrink-0"
                                      aria-hidden
                                    >
                                      ▸
                                    </span>
                                  </div>
                                </div>
                                {getNoteForScheduleDate(sd) && (
                                  <p className="text-xs text-accent mt-1">
                                    {getNoteForScheduleDate(sd)}
                                  </p>
                                )}
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </WeekSection>
              ))}
        </div>

        {viewMode === "calendar" && (
          <CalendarGrid
            year={schedule.year}
            month={schedule.month}
            today={today}
            entryDates={new Set(entryDates)}
            filteredDateSet={new Set(filteredDates)}
            forEveryoneSet={forEveryoneSet}
            hasActiveFilter={hasActiveFilter}
            hasDependentRoleOnDate={hasDependentRoleOnDate}
            hasRelevantRoleOnDate={hasRelevantRoleOnDate}
            isPast={isPast}
            onSelectDate={setSelectedDateForModal}
            t={t}
          />
        )}

        <div
          ref={desktopTableRef}
          className={`hidden lg:block space-y-8 ${viewMode !== "list" ? "!hidden" : ""}`}
        >
          {(() => {
                const visibleRoles = filteredRoleId
                  ? roleOrder.filter((r) => r.id === filteredRoleId)
                  : roleOrder;
                const desktopDatesByWeek = filteredMemberId ? displayDatesByWeek : tableDatesByWeek;
                const COL_MIN_WIDTH = 130;
                const DATE_COL_WIDTH = 170;
                const estimatedTableWidth = visibleRoles.length * COL_MIN_WIDTH + DATE_COL_WIDTH;
                const useCardLayout = desktopContainerWidth > 0 && estimatedTableWidth > desktopContainerWidth;

                const renderMemberName = (memberId: number, memberName: string, date: string) => (
                  <span className={`inline-flex items-center gap-0.5 text-xs ${filteredMemberId === memberId ? "font-bold text-foreground" : "font-medium"}`}>
                    {memberName}
                    {hasConflict(date, memberId) && (
                      <span className="text-amber-500 shrink-0" title={t("conflictWithHolidays")}>⚠</span>
                    )}
                  </span>
                );

                const hasFilteredMember = (entries: typeof schedule.entries) =>
                  filteredMemberId != null && entries.some((e) => e.memberId === filteredMemberId);

                return (
                  <>
                    {desktopDatesByWeek.map(({ weekNumber, dates }) => {
                      const isCollapsed = collapsedWeeks.has(weekNumber);
                      return (
                        <section
                          key={weekNumber}
                          className="border border-border rounded-lg overflow-hidden bg-muted/5"
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
                                {weekDateRangeLabel(weekNumber)}
                              </span>
                            </h2>
                            <span
                              className="text-muted-foreground shrink-0"
                              aria-hidden
                            >
                              {isCollapsed ? "▶" : "▼"}
                            </span>
                          </button>
                          {!isCollapsed && useCardLayout && (
                            <div className="divide-y divide-border">
                              {dates.map((date) => {
                                const sd = scheduleDateByDateMap.get(date) ?? { date, type: "assignable" as const };
                                const isForEveryone = forEveryoneSet.has(date);
                                const entriesOnDate = schedule.entries.filter(
                                  (e) => e.date === date && (!filteredRoleId || e.roleId === filteredRoleId)
                                );
                                const note = getNoteForScheduleDate(sd);
                                const label = !isForEveryone ? getDateDisplayLabel(sd) : null;
                                const timeRange = getDateDisplayTimeRange(sd);
                                return (
                                  <div
                                    key={date}
                                    className={`px-4 py-3.5 ${isPast(date) ? "opacity-50" : ""} ${isForEveryone ? "bg-muted/20" : ""}`}
                                  >
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="font-medium text-sm">{formatDateWeekdayDay(date)}</span>
                                      {label && (
                                        <span className="text-xs text-muted-foreground italic shrink-0">{label}</span>
                                      )}
                                    </div>
                                    {timeRange && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{timeRange}</p>
                                    )}
                                    {isForEveryone ? (
                                      <p className="text-sm text-muted-foreground italic mt-1">
                                        {getDateDisplayLabel(sd)}
                                      </p>
                                    ) : entriesOnDate.length > 0 ? (
                                      <div className="mt-2 rounded-md border border-border/40 overflow-hidden">
                                        <table className="w-full text-sm border-collapse">
                                          <tbody>
                                            {visibleRoles.map((role) => {
                                              const roleEntries = entriesOnDate.filter((e) => e.roleId === role.id);
                                              if (roleEntries.length === 0) return null;
                                              return (
                                                <tr key={role.id} className={`border-b border-border/40 last:border-b-0 ${hasFilteredMember(roleEntries) ? "bg-primary/10" : ""}`}>
                                                  <td className="px-3 py-1.5 text-xs font-medium text-muted-foreground align-top w-1/3">
                                                    {role.name}
                                                  </td>
                                                  <td className="px-3 py-1.5 align-top">
                                                    {roleEntries.length === 1 ? (
                                                      renderMemberName(roleEntries[0].memberId, roleEntries[0].memberName, date)
                                                    ) : (
                                                      <span className="flex flex-col gap-0.5">
                                                        {[...roleEntries]
                                                          .sort((a, b) => a.memberName.localeCompare(b.memberName, "es"))
                                                          .map((e) => (
                                                            <React.Fragment key={e.id}>
                                                              {renderMemberName(e.memberId, e.memberName, date)}
                                                            </React.Fragment>
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
                                      <p className="text-xs text-accent mt-1.5">{note}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!isCollapsed && !useCardLayout && (
                            <div className="overflow-x-auto">
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
                                    const sd =
                                      scheduleDateByDateMap.get(date) ?? {
                                        date,
                                        type: "assignable" as const,
                                      };
                                    const isForEveryone = forEveryoneSet.has(date);
                                    const entriesOnDate = schedule.entries.filter(
                                      (e) => e.date === date && (!filteredRoleId || e.roleId === filteredRoleId)
                                    );
                                    const note = getNoteForScheduleDate(sd);
                                    return (
                                      <tr
                                        key={date}
                                        className={[
                                          "border-b border-border",
                                          isForEveryone ? "bg-muted/20" : "",
                                          isPast(date) ? "opacity-50" : "",
                                          "hover:bg-muted/20 transition-colors",
                                        ]
                                          .filter(Boolean)
                                          .join(" ")}
                                      >
                                        <td className="px-4 py-4 text-sm font-medium whitespace-nowrap align-middle">
                                          <div>
                                            {formatDateWeekdayDay(date)}
                                          </div>
                                          {!isForEveryone &&
                                            getDateDisplayLabel(sd) && (
                                              <div className="text-xs text-muted-foreground italic font-normal mt-0.5">
                                                {getDateDisplayLabel(sd)}
                                              </div>
                                            )}
                                          {!isForEveryone &&
                                            getDateDisplayTimeRange(sd) && (
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
                                        {isForEveryone ? (
                                          <td
                                            colSpan={visibleRoles.length}
                                            className="px-4 py-4 text-sm text-muted-foreground italic text-center"
                                          >
                                            {getDateDisplayLabel(sd)}
                                            {getDateDisplayTimeRange(sd) && (
                                              <div className="text-xs mt-0.5 font-normal">
                                                {getDateDisplayTimeRange(sd)}
                                              </div>
                                            )}
                                          </td>
                                        ) : (
                                          visibleRoles.map((role) => {
                                            const roleEntries =
                                              entriesOnDate.filter(
                                                (e) => e.roleId === role.id
                                              );
                                            return (
                                              <td
                                                key={role.id}
                                                className={`px-4 py-4 text-sm align-middle ${hasFilteredMember(roleEntries) ? "bg-primary/10" : ""}`}
                                              >
                                                {roleEntries.length === 0 ? (
                                                  <span className="text-muted-foreground/40">
                                                    —
                                                  </span>
                                                ) : roleEntries.length === 1 ? (
                                                  renderMemberName(roleEntries[0].memberId, roleEntries[0].memberName, date)
                                                ) : (
                                                  <span className="text-xs">
                                                    {[...roleEntries]
                                                      .sort((a, b) =>
                                                        a.memberName.localeCompare(
                                                          b.memberName,
                                                          "es"
                                                        )
                                                      )
                                                      .map((e, i) => (
                                                        <React.Fragment key={e.id}>
                                                          {i > 0 && (
                                                            <span className="text-muted-foreground">
                                                              ,{" "}
                                                            </span>
                                                          )}
                                                          {renderMemberName(e.memberId, e.memberName, date)}
                                                        </React.Fragment>
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
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </>
                );
              })()}
        </div>

        {displayDates.length === 0 && !upcomingDate && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {filteredMemberId
                ? t("noAssignmentsThisMonth")
                : hasActiveFilter
                  ? t("noAssignmentsFilter")
                  : t("noEntries")}
            </p>
          </div>
        )}
      </main>

      <DateDetailModal
        open={!!selectedDateForModal}
        onOpenChange={(open) => !open && setSelectedDateForModal(null)}
        selectedDate={selectedDateForModal}
        schedule={schedule}
        roleOrder={roleOrder}
        scheduleDateByDateMap={scheduleDateByDateMap}
        getDateDisplayLabel={getDateDisplayLabel}
        getDateDisplayTimeRange={getDateDisplayTimeRange}
        getNoteForScheduleDate={getNoteForScheduleDate}
        hasConflict={hasConflict}
        filteredMemberId={filteredMemberId}
        t={t}
      />
    </div>
  );
}
