"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import { formatDateLong } from "@/lib/timezone-utils";

interface Assignment {
  date: string;
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
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-4xl sm:text-5xl uppercase">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

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
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg py-12 text-center">
            <p className="text-muted-foreground">{t("noAssignments")}</p>
          </div>
        ) : (
          <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            {filtered.map((a, i) => (
              <li
                key={`${a.date}-${a.groupId}-${a.roleName}-${i}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize">{formatDateLong(a.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.roleName} · {a.groupName}
                  </p>
                  {conflictDateSet.has(a.date) && (
                    <p className="text-xs text-destructive mt-0.5">{tHome("conflictMultipleGroups")}</p>
                  )}
                </div>
                <Link
                  href={`/${a.groupSlug}/cronograma/${a.date.slice(0, 4)}/${a.date.slice(5, 7)}`}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground transition-colors"
                >
                  {t("viewCronograma")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
