"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  formatDateWeekdayDay,
  formatDateRange,
} from "@/lib/timezone-utils";
import {
  type ScheduleDateInfo,
  type SharedScheduleData,
  getTodayISO,
  getWeekDateRange,
} from "./types";
import { MonthHeader } from "./MonthHeader";
import { WeekSection } from "./WeekSection";
import { getDateDisplayTimeRange } from "./helpers";
import { DesktopTable } from "./DesktopTable";
import { useScheduleData } from "./useScheduleData";
import { useIsDesktop } from "@/lib/use-is-desktop";

const CalendarGrid = dynamic(
  () => import("./CalendarGrid").then((m) => ({ default: m.CalendarGrid })),
);
const MemberAgendaCard = dynamic(
  () => import("./MemberAgendaCard").then((m) => ({ default: m.MemberAgendaCard })),
);
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

function computeCollapsedWeeks(
  datesByWeek: { weekNumber: number; dates?: string[] }[],
  scheduleDatesByWeek: { weekNumber: number; scheduleDates?: ScheduleDateInfo[] }[],
  useScheduleDateRows: boolean,
): Set<number> {
  const weekData = useScheduleDateRows ? scheduleDatesByWeek : datesByWeek;
  if (weekData.length === 0) return new Set();
  const todayStr = getTodayISO();
  const weekWithToday = useScheduleDateRows
    ? (scheduleDatesByWeek as { weekNumber: number; scheduleDates: ScheduleDateInfo[] }[]).find(
        (w) => w.scheduleDates.some((sd) => sd.date === todayStr),
      )?.weekNumber
    : (datesByWeek as { weekNumber: number; dates: string[] }[]).find((w) =>
        w.dates.includes(todayStr),
      )?.weekNumber;
  const allWeekNumbers = weekData.map((w) => w.weekNumber);
  const toCollapse =
    weekWithToday != null
      ? allWeekNumbers.filter((n) => n !== weekWithToday)
      : allWeekNumbers;
  return new Set(toCollapse);
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
  // Both layouts render until the breakpoint is known (the CSS classes below
  // hide the wrong one, so the first paint is correct at any width). After
  // that only the visible one is mounted: keeping both alive meant every
  // filter change re-rendered a whole month of rows nobody could see.
  const isDesktop = useIsDesktop();
  const renderMobileList = isDesktop !== true;
  const renderDesktopTable = isDesktop !== false;
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
  const currentTimeRef = useRef(currentTime);

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

  useLayoutEffect(() => {
    queueMicrotask(() => setToday(getTodayISO()));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const now = Date.now();
      currentTimeRef.current = now;
      setCurrentTime(now);
    });
    const interval = setInterval(() => {
      const now = Date.now();
      const prev = currentTimeRef.current;
      currentTimeRef.current = now;
      const scheduleDates = schedule.scheduleDates ?? [];
      if (showPastDates || scheduleDates.length === 0) return;
      const crossed = scheduleDates.some((sd) => {
        const endUtc = sd.endTimeUtc ?? sd.recurringEventEndTimeUtc ?? "23:59";
        const [h, m] = endUtc.split(":").map(Number);
        const endMs = new Date(
          `${sd.date}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00.000Z`,
        ).getTime();
        return endMs >= prev && endMs < now;
      });
      if (crossed) setCurrentTime(now);
    }, 60000);
    return () => clearInterval(interval);
  }, [schedule.scheduleDates, showPastDates]);

  useEffect(() => {
    queueMicrotask(() => setSelectedDateForModal(null));
  }, [filteredMemberId]);

  const data = useScheduleData({
    schedule,
    filteredMemberId,
    filteredRoleId,
    dayFilter,
    showPastDates,
    today,
    currentTime,
    t,
  });

  const {
    dependentRoleIdSet,
    entryDateSet,
    scheduleDateByDateMap,
    roleOrder,
    forEveryoneSet,
    availableWeekdays,
    hasActiveFilter,
    selectedMember,
    filteredDateSet,
    assignedDateCount,
    upcomingDate,
    displayDates,
    displayDatesByWeek,
    tableDatesByWeek,
    displayScheduleDatesByWeek,
    tableScheduleDatesByWeek,
    useScheduleDateRows,
    getDateDisplayLabel,
    hasConflict,
    isPast,
    hasDependentRoleOnDate,
    hasRelevantRoleOnDate,
    getDependentRoleNamesOnDate,
    getNonDependentRolesForDate,
    getEntriesForScheduleDate,
  } = data;

  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(() =>
    computeCollapsedWeeks(tableDatesByWeek, tableScheduleDatesByWeek, useScheduleDateRows),
  );
  const initialCollapseKeyRef = useRef<string | null>(
    `${schedule.year}-${schedule.month}-all-all-${useScheduleDateRows}`,
  );

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
    // Re-attaches when crossing the breakpoint remounts the table.
  }, [renderDesktopTable]);
  const toggleWeek = useCallback((weekNumber: number) => {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  }, []);

  useLayoutEffect(() => {
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
    queueMicrotask(() => setCollapsedWeeks(computeCollapsedWeeks(
      byWeek as { weekNumber: number; dates: string[] }[],
      byWeekSd as { weekNumber: number; scheduleDates: ScheduleDateInfo[] }[],
      useScheduleDateRows,
    )));
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

  // Stable across renders so DesktopTable's memo actually holds: a new
  // function here re-rendered the whole table on every filter change. It also
  // computed the same week range twice per call.
  const weekDateRangeLabel = useCallback(
    (weekNumber: number) => {
      const { start, end } = getWeekDateRange(schedule.year, schedule.month, weekNumber);
      return formatDateRange(start, end);
    },
    [schedule.year, schedule.month],
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
            scheduleDateByDateMap={scheduleDateByDateMap}
            t={t}
          />
        )}

        {renderMobileList && (
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
                          entriesOnSd.some((e) => data.relevantRoleIdSet.has(e.roleId));
                        const highlighted = depRoleDate || relevantRoleDate;
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
        )}

        {viewMode === "calendar" && (
          <CalendarGrid
            year={schedule.year}
            month={schedule.month}
            today={today}
            entryDates={entryDateSet}
            filteredDateSet={filteredDateSet}
            forEveryoneSet={forEveryoneSet}
            hasActiveFilter={hasActiveFilter}
            hasDependentRoleOnDate={hasDependentRoleOnDate}
            hasRelevantRoleOnDate={hasRelevantRoleOnDate}
            isPast={isPast}
            onSelectDate={setSelectedDateForModal}
            t={t}
          />
        )}

        {renderDesktopTable && (
          <div
            ref={desktopTableRef}
            className={`hidden lg:block space-y-8 ${viewMode !== "list" ? "!hidden" : ""}`}
          >
            <DesktopTable
              datesByWeek={filteredMemberId ? displayDatesByWeek : tableDatesByWeek}
              roleOrder={roleOrder}
              filteredRoleId={filteredRoleId}
              filteredMemberId={filteredMemberId}
              entries={schedule.entries}
              scheduleDateByDateMap={scheduleDateByDateMap}
              forEveryoneSet={forEveryoneSet}
              collapsedWeeks={collapsedWeeks}
              toggleWeek={toggleWeek}
              weekDateRangeLabel={weekDateRangeLabel}
              desktopContainerWidth={desktopContainerWidth}
              getDateDisplayLabel={getDateDisplayLabel}
              hasConflict={hasConflict}
              isPast={isPast}
              t={t}
            />
          </div>
        )}

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

      {selectedDateForModal && (
        <DateDetailModal
          open
          onOpenChange={(open) => !open && setSelectedDateForModal(null)}
          selectedDate={selectedDateForModal}
          schedule={schedule}
          roleOrder={roleOrder}
          scheduleDateByDateMap={scheduleDateByDateMap}
          getDateDisplayLabel={getDateDisplayLabel}
          getDateDisplayTimeRange={getDateDisplayTimeRange}
          hasConflict={hasConflict}
          filteredMemberId={filteredMemberId}
          t={t}
        />
      )}
    </div>
  );
}
