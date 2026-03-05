"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import { formatDateLong, utcTimeToLocalDisplay } from "@/lib/timezone-utils";
import { getConflictTimespans } from "@/lib/dashboard-conflicts";
import LoadingScreen from "@/components/LoadingScreen";

interface Group {
  id: number;
  name: string;
  slug: string;
  ownerId: string;
  role: "owner" | "collaborator" | "member";
}

interface Assignment {
  date: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  roleName: string;
  groupName: string;
  groupSlug: string;
  groupId: number;
}

interface Conflict {
  date: string;
  groups: string[];
}

interface DashboardData {
  assignments: Assignment[];
  conflicts: Conflict[];
}

function getRelativeLabel(
  dateStr: string,
  todayStr: string,
  t: (key: string, opts?: { n?: number }) => string,
): string {
  const [dy, dm, dd] = dateStr.split("-").map(Number);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const d = new Date(dy, dm - 1, dd);
  const todayDate = new Date(ty, tm - 1, td);
  const diff = Math.round((d.getTime() - todayDate.getTime()) / 86400000);
  if (diff === 0) return t("today");
  if (diff === 1) return t("tomorrow");
  if (diff < 0) return t("daysAgo", { n: Math.abs(diff) });
  return t("daysAhead", { n: diff });
}

export default function HomePage() {
  const { data: session } = useSession();
  const t = useTranslations("home");
  const [groups, setGroups] = useState<Group[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  const canCreate = session?.user?.isAdmin || session?.user?.canCreateGroups || false;

  const ROLE_LABELS: Record<string, string> = useMemo(
    () => ({
      owner: t("roleOwner"),
      collaborator: t("roleCollaborator"),
      member: t("roleMember"),
    }),
    [t],
  );

  const fetchData = useCallback(async () => {
    const [groupsRes, dashboardRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/user/dashboard"),
    ]);
    setGroups(await groupsRes.json());
    setDashboard(await dashboardRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    if (!dashboard) return map;
    for (const a of dashboard.assignments) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return map;
  }, [dashboard]);

  const conflictDateSet = useMemo(() => {
    if (!dashboard) return new Set<string>();
    return new Set(dashboard.conflicts.map((c) => c.date));
  }, [dashboard]);

  const nextAssignment = useMemo(() => {
    if (!dashboard || dashboard.assignments.length === 0) return null;
    const future = dashboard.assignments.filter((a) => a.date >= todayISO);
    if (future.length === 0) return null;
    const firstDate = future[0].date;
    const onDate = future.filter((a) => a.date === firstDate);

    const byGroup = new Map<number, { groupName: string; groupSlug: string; roles: string[] }>();
    for (const a of onDate) {
      const existing = byGroup.get(a.groupId);
      if (existing) {
        existing.roles.push(a.roleName);
      } else {
        byGroup.set(a.groupId, { groupName: a.groupName, groupSlug: a.groupSlug, roles: [a.roleName] });
      }
    }

    return { date: firstDate, items: [...byGroup.values()] };
  }, [dashboard, todayISO]);

  if (loading) {
    return <LoadingScreen fullPage />;
  }

  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const firstDayDow = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
  const leadingBlanks = firstDayDow === 0 ? 6 : firstDayDow - 1;
  const MONTH_NAMES = getRawArray(t, "monthsLowercase");
  const dayHeaders = getRawArray(t, "dayHeaders");
  const hasAssignments = dashboard && dashboard.assignments.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="space-y-8 lg:grid lg:grid-cols-[1fr_1px_1fr] lg:gap-8 lg:space-y-0">
          {/* Left column: assignments + calendar */}
          <div className="space-y-8">
            {/* Next assignment card */}
            {nextAssignment && (
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-4">
                  {t("nextAssignment")}
                </h2>
                <p className="font-medium capitalize text-foreground">
                  {formatDateLong(nextAssignment.date)}
                  <span className="ml-2 text-sm text-muted-foreground font-normal">
                    — {getRelativeLabel(nextAssignment.date, todayISO, t)}
                  </span>
                </p>
                {conflictDateSet.has(nextAssignment.date) && (
                  <p className="text-xs text-destructive mt-1">{t("conflictMultipleGroups")}</p>
                )}
                <div className="mt-3 space-y-1.5">
                  {nextAssignment.items.map((item) => (
                    <div key={item.groupSlug} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {item.roles.join(", ")}
                      </p>
                      <Link
                        href={`/${item.groupSlug}/cronograma`}
                        className="shrink-0 text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                      >
                        {item.groupName} &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Calendar card */}
            {hasAssignments && (
              <section className="rounded-xl border border-border bg-card p-6">
                <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-4">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </h2>
                <div className="max-w-md mx-auto lg:max-w-none lg:mx-0">
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {dayHeaders.map((d) => (
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
                      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                      const dateAssignments = assignmentsByDate.get(dateStr);
                      const hasAny = !!dateAssignments && dateAssignments.length > 0;
                      const isConflict = conflictDateSet.has(dateStr);
                      const isToday = dateStr === todayISO;
                      const isPast = dateStr < todayISO;

                      return (
                        <button
                          key={dayNum}
                          onClick={() => { if (hasAny) setCalendarSelectedDate(dateStr); }}
                          disabled={!hasAny}
                          className={[
                            "aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors relative",
                            isPast ? "opacity-50" : "",
                            isToday ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : "",
                            isConflict
                              ? "bg-destructive/15 text-destructive"
                              : hasAny
                                ? "bg-muted hover:bg-muted/80 text-foreground"
                                : "text-muted-foreground",
                            hasAny ? "cursor-pointer" : "cursor-default",
                          ].filter(Boolean).join(" ")}
                        >
                          {dayNum}
                          {isConflict && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-destructive" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Vertical divider */}
          <div className="hidden lg:block bg-border" />

          {/* Right column: groups card */}
          <div className="lg:pt-0">
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
                  {t("myGroups")}
                </h2>
                {canCreate && (
                  <Link
                    href="/groups/new"
                    className="text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                  >
                    {t("createGroup")}
                  </Link>
                )}
              </div>
              {groups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    {t("noGroups")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate text-foreground">{group.name}</h3>
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {ROLE_LABELS[group.role]}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          /{group.slug}
                        </p>
                      </div>
                      {(group.role === "owner" || group.role === "collaborator") && (
                        <Link
                          href={`/${group.slug}/config`}
                          className="shrink-0 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:border-accent hover:bg-muted/50 transition-colors"
                        >
                          {t("configure")}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Calendar day detail modal */}
      {calendarSelectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setCalendarSelectedDate(null)}
        >
          <div
            className="rounded-xl border border-border bg-card shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium capitalize text-foreground">
                  {formatDateLong(calendarSelectedDate)}
                </h3>
                {conflictDateSet.has(calendarSelectedDate) && (
                  <p className="text-xs text-destructive mt-0.5">{t("conflict")}</p>
                )}
              </div>
              <button
                onClick={() => setCalendarSelectedDate(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t("close")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {conflictDateSet.has(calendarSelectedDate) && (() => {
                const dateAssignments = assignmentsByDate.get(calendarSelectedDate) ?? [];
                const withTime = dateAssignments.filter(
                  (a): a is Assignment & { startTimeUtc: string; endTimeUtc: string } =>
                    a.startTimeUtc != null && a.endTimeUtc != null,
                );
                const timespans = withTime.length >= 2 ? getConflictTimespans(withTime) : [];
                return timespans.length > 0 ? (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 mb-3 space-y-1">
                    <p className="text-xs font-medium text-destructive uppercase tracking-wide">
                      {t("conflict")}
                    </p>
                    {timespans.map((ts, idx) => (
                      <p key={idx} className="text-sm text-foreground">
                        {ts.groupNames.join(" · ")}: {utcTimeToLocalDisplay(ts.startUtc)}–{utcTimeToLocalDisplay(ts.endUtc)}
                      </p>
                    ))}
                  </div>
                ) : null;
              })()}
              {(assignmentsByDate.get(calendarSelectedDate) ?? []).map((a) => (
                <div
                  key={`${a.date}-${a.groupSlug}-${a.roleName}`}
                  className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2"
                >
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    {a.roleName}
                    {a.startTimeUtc != null && a.endTimeUtc != null && (
                      <span className="normal-case ml-1.5 text-muted-foreground">
                        {utcTimeToLocalDisplay(a.startTimeUtc)}–{utcTimeToLocalDisplay(a.endTimeUtc)}
                      </span>
                    )}
                  </span>
                  <Link
                    href={`/${a.groupSlug}/cronograma`}
                    onClick={() => setCalendarSelectedDate(null)}
                    className="text-xs font-medium text-accent hover:opacity-80 transition-opacity"
                  >
                    {a.groupName} &rarr;
                  </Link>
                </div>
              ))}
              {(assignmentsByDate.get(calendarSelectedDate) ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noAssignments")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
