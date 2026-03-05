"use client";

import { MONTH_NAMES } from "./types";
import type { SharedScheduleData } from "./types";

export interface MonthHeaderProps {
  schedule: Pick<
    SharedScheduleData,
    "groupName" | "month" | "year" | "prevSchedule" | "nextSchedule" | "members"
  >;
  basePath: string;
  t: (key: string) => string;
  filteredMemberId: number | null;
  setFilteredMemberId: (id: number | null) => void;
  filteredRoleId: number | null;
  setFilteredRoleId: (id: number | null) => void;
  dayFilter: string;
  setDayFilter: (v: string) => void;
  showPastDates: boolean;
  setShowPastDates: (v: boolean) => void;
  viewMode: "list" | "calendar";
  setViewMode: (v: "list" | "calendar") => void;
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (v: boolean) => void;
  roleOrder: { id: number; name: string }[];
  availableWeekdays: string[];
  calendarResult: string | null;
}

export function MonthHeader({
  schedule,
  basePath,
  t,
  filteredMemberId,
  setFilteredMemberId,
  filteredRoleId,
  setFilteredRoleId,
  dayFilter,
  setDayFilter,
  showPastDates,
  setShowPastDates,
  viewMode,
  setViewMode,
  mobileFiltersOpen,
  setMobileFiltersOpen,
  roleOrder,
  availableWeekdays,
  calendarResult,
}: MonthHeaderProps) {
  const filterCount = [
    filteredMemberId,
    filteredRoleId,
    dayFilter,
    showPastDates,
  ].filter(Boolean).length;

  return (
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
            <span className="text-sm text-muted-foreground/40 cursor-default">
              ←
            </span>
          )}
          <div className="text-center">
            {schedule.groupName && (
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {schedule.groupName}
              </p>
            )}
            <h1 className="font-[family-name:var(--font-display)] font-semibold text-2xl sm:text-3xl uppercase">
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
            <span className="text-sm text-muted-foreground/40 cursor-default">
              →
            </span>
          )}
        </div>

        <div className="border-t border-border mt-3 sm:hidden -mx-4" />

        <div className="mt-3 flex items-start justify-between gap-3">
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="sm:hidden flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {filterCount > 0 ? `${t("filters")} (${filterCount})` : t("filters")}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

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
              {schedule.members?.map((m) => (
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
                  <span className="text-muted-foreground">
                    {t("showPastDates")}
                  </span>
                </label>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex w-fit rounded-lg border border-border p-0.5 shrink-0">
              <button
                onClick={() => {
                  setViewMode("list");
                  setDayFilter("");
                  setShowPastDates(false);
                }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("list")}
              </button>
              <button
                onClick={() => {
                  setViewMode("calendar");
                  setDayFilter("");
                  setShowPastDates(false);
                }}
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
          <p
            className="mt-2 text-sm text-green-600 dark:text-green-400"
            role="status"
          >
            {t("saveInCalendarSuccess")}
          </p>
        )}
        {calendarResult === "error" && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {t("saveInCalendarError")}
          </p>
        )}

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
              {schedule.members?.map((m) => (
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
                  <span className="text-muted-foreground">
                    {t("showPastDates")}
                  </span>
                </label>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
