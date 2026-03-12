"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import { formatDateLong, utcTimeToLocalDisplay } from "@/lib/timezone-utils";

interface Assignment {
  date: string;
  startTimeUtc: string;
  endTimeUtc: string;
  roleName: string;
  groupName: string;
  groupSlug: string;
  groupId: number;
  groupCalendarExportEnabled?: boolean;
}

interface Conflict {
  date: string;
  groups: string[];
}

interface AssignmentsClientProps {
  assignments: Assignment[];
  conflicts: Conflict[];
  canExportCalendars: boolean;
}

export default function AssignmentsClient({
  assignments,
  conflicts,
  canExportCalendars,
}: AssignmentsClientProps) {
  const searchParams = useSearchParams();
  const calendarResult = searchParams.get("calendar");
  const t = useTranslations("myAssignments");
  const tHome = useTranslations("home");
  const tCronograma = useTranslations("cronograma");
  const [, startTransition] = useTransition();
  const [filterGroupId, setFilterGroupId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterRole, setFilterRole] = useState<string>("");

  const uniqueGroups = useMemo(() => {
    const seen = new Map<number, { groupId: number; groupName: string; groupSlug: string }>();
    for (const a of assignments) {
      if (!seen.has(a.groupId)) seen.set(a.groupId, { groupId: a.groupId, groupName: a.groupName, groupSlug: a.groupSlug });
    }
    return [...seen.values()].sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [assignments]);

  const uniqueRoles = useMemo(() => {
    const roleNames = new Set(assignments.map((a) => a.roleName));
    return [...roleNames].sort();
  }, [assignments]);

  const years = useMemo(() => {
    const yearsSet = new Set(assignments.map((a) => a.date.slice(0, 4)));
    return [...yearsSet].sort((a, b) => b.localeCompare(a));
  }, [assignments]);

  const filtered = useMemo(() => {
    return assignments.filter((assignment) => {
      if (filterGroupId && assignment.groupId !== parseInt(filterGroupId, 10)) return false;
      if (filterRole && assignment.roleName !== filterRole) return false;
      if (filterYear && assignment.date.slice(0, 4) !== filterYear) return false;
      if (filterMonth && assignment.date.slice(5, 7) !== filterMonth.padStart(2, "0")) return false;
      return true;
    });
  }, [assignments, filterGroupId, filterRole, filterYear, filterMonth]);

  const conflictDateSet = useMemo(() => {
    return new Set(conflicts.map((c) => c.date));
  }, [conflicts]);

  const conflictGroupsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of conflicts) {
      map.set(c.date, new Set(c.groups));
    }
    return map;
  }, [conflicts]);

  type GroupEntry = { groupName: string; groupSlug: string; roles: string[] };
  type TimespanEntry = { startTimeUtc: string; endTimeUtc: string; groups: GroupEntry[] };

  const groupedByDate = useMemo(() => {
    const dateMap = new Map<string, Map<string, { startTimeUtc: string; endTimeUtc: string; groupMap: Map<number, GroupEntry> }>>();
    for (const a of filtered) {
      if (!dateMap.has(a.date)) dateMap.set(a.date, new Map());
      const timespanMap = dateMap.get(a.date)!;
      const tsKey = `${a.startTimeUtc}|${a.endTimeUtc}`;
      if (!timespanMap.has(tsKey)) {
        timespanMap.set(tsKey, { startTimeUtc: a.startTimeUtc, endTimeUtc: a.endTimeUtc, groupMap: new Map() });
      }
      const { groupMap } = timespanMap.get(tsKey)!;
      const existing = groupMap.get(a.groupId);
      if (existing) {
        existing.roles.push(a.roleName);
      } else {
        groupMap.set(a.groupId, { groupName: a.groupName, groupSlug: a.groupSlug, roles: [a.roleName] });
      }
    }
    return [...dateMap.entries()].map(([date, timespanMap]) => ({
      date,
      timespans: [...timespanMap.values()].map((ts): TimespanEntry => ({
        startTimeUtc: ts.startTimeUtc,
        endTimeUtc: ts.endTimeUtc,
        groups: [...ts.groupMap.values()],
      })),
    }));
  }, [filtered]);

  const canExportToCalendar =
    canExportCalendars &&
    filtered.some((a) => a.groupCalendarExportEnabled === true);

  const calendarExportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filterGroupId) params.set("groupId", filterGroupId);
    if (filterYear) params.set("year", filterYear);
    if (filterMonth) params.set("month", filterMonth);
    const q = params.toString();
    return `/api/user/assignments/google-calendar${q ? `?${q}` : ""}`;
  }, [filterGroupId, filterYear, filterMonth]);

  return (
    <>
      {calendarResult === "success" && (
          <p className="mb-4 text-sm text-green-600 dark:text-green-400" role="status">
            {tCronograma("saveInCalendarSuccess")}
          </p>
        )}
        {calendarResult === "error" && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {tCronograma("saveInCalendarError")}
          </p>
        )}

        {canExportToCalendar && (
          <div className="mb-6">
            <a
              href={calendarExportHref}
              className="inline-block rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
            >
              {tCronograma("saveInCalendar")}
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("filterGroup")}
            </label>
            <select
              value={filterGroupId}
              onChange={(e) => startTransition(() => setFilterGroupId(e.target.value))}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="">{t("allGroups")}</option>
              {uniqueGroups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("filterRole")}
            </label>
            <select
              value={filterRole}
              onChange={(e) => startTransition(() => setFilterRole(e.target.value))}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="">{t("allRoles")}</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("filterYear")}
            </label>
            <select
              value={filterYear}
              onChange={(e) => startTransition(() => setFilterYear(e.target.value))}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="">{t("allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("filterMonth")}
            </label>
            <select
              value={filterMonth}
              onChange={(e) => startTransition(() => setFilterMonth(e.target.value))}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {getRawArray(tHome, "monthsLowercase").map((name, i) => (
                <option key={i} value={String(i + 1)}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {groupedByDate.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg py-12 text-center">
            <p className="text-muted-foreground">{t("noAssignments")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map(({ date, timespans }) => (
              <div key={date} className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 flex items-center justify-between gap-2">
                  <p className="font-medium capitalize text-sm">{formatDateLong(date)}</p>
                  {conflictDateSet.has(date) && (
                    <span className="flex items-center gap-1.5 text-xs text-destructive">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      {tHome("possibleConflicts")}
                    </span>
                  )}
                </div>
                {timespans.map((ts) => {
                  const isAllDay = ts.startTimeUtc === "00:00" && ts.endTimeUtc === "23:59";
                  const tsLabel = isAllDay
                    ? t("allDay")
                    : `${utcTimeToLocalDisplay(ts.startTimeUtc)}–${utcTimeToLocalDisplay(ts.endTimeUtc)}`;

                  return (
                    <div key={`${ts.startTimeUtc}-${ts.endTimeUtc}`}>
                      <div className="px-4 py-2 border-t border-border bg-muted/20">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tsLabel}</p>
                      </div>
                      <div className="divide-y divide-border">
                        {ts.groups.map((g) => {
                          const isConflicting = conflictGroupsByDate.get(date)?.has(g.groupName) ?? false;
                          return (
                          <div
                            key={g.groupSlug}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                {g.groupName}
                                {isConflicting && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-destructive" />}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {g.roles.join(", ")}
                              </p>
                            </div>
                            <Link
                              href={`/${g.groupSlug}/cronograma/${date.slice(0, 4)}/${date.slice(5, 7)}`}
                              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground transition-colors"
                            >
                              {t("viewCronograma")}
                            </Link>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
      )}
    </>
  );
}
