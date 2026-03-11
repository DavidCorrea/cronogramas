"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { getRawArray } from "@/lib/intl-utils";
import { formatDateLong, utcTimeToLocalDisplay } from "@/lib/timezone-utils";
import { getConflictTimespans } from "@/lib/dashboard-conflicts";

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

interface DashboardClientProps {
  groups: Group[];
  assignments: Assignment[];
  conflicts: Conflict[];
  canCreate: boolean;
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

export default function DashboardClient({
  groups,
  assignments,
  conflicts,
  canCreate,
}: DashboardClientProps) {
  const t = useTranslations("home");
  const [, startTransition] = useTransition();
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  const ROLE_LABELS: Record<string, string> = useMemo(
    () => ({
      owner: t("roleOwner"),
      collaborator: t("roleCollaborator"),
      member: t("roleMember"),
    }),
    [t],
  );

  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    }
    return map;
  }, [assignments]);

  const conflictDateSet = useMemo(() => {
    return new Set(conflicts.map((c) => c.date));
  }, [conflicts]);

  type CalendarDateRow = {
    groupName: string;
    groupSlug: string;
    roles: string[];
    startTimeUtc?: string;
    endTimeUtc?: string;
  };
  const calendarDateDetailRows = useMemo((): CalendarDateRow[] => {
    if (!calendarSelectedDate) return [];
    const dateAssignments = (assignmentsByDate.get(calendarSelectedDate) ?? []) as Assignment[];
    const byGroup = new Map<string, CalendarDateRow>();
    for (const a of dateAssignments) {
      const existing = byGroup.get(a.groupSlug);
      if (existing) {
        existing.roles.push(a.roleName);
      } else {
        byGroup.set(a.groupSlug, {
          groupName: a.groupName,
          groupSlug: a.groupSlug,
          roles: [a.roleName],
          startTimeUtc: a.startTimeUtc,
          endTimeUtc: a.endTimeUtc,
        });
      }
    }
    return [...byGroup.values()];
  }, [calendarSelectedDate, assignmentsByDate]);

  const calendarDateConflictContent = useMemo(() => {
    if (!calendarSelectedDate || !conflictDateSet.has(calendarSelectedDate)) return null;
    const dateAssignments = assignmentsByDate.get(calendarSelectedDate) ?? [];
    const withTime = dateAssignments.filter(
      (a): a is Assignment & { startTimeUtc: string; endTimeUtc: string } =>
        a.startTimeUtc != null && a.endTimeUtc != null,
    );
    const timespans = withTime.length >= 2 ? getConflictTimespans(withTime) : [];
    return timespans.length > 0 ? timespans : null;
  }, [calendarSelectedDate, conflictDateSet, assignmentsByDate]);

  const nextAssignment = useMemo(() => {
    if (assignments.length === 0) return null;
    const future = assignments.filter((a) => a.date >= todayISO);
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
  }, [assignments, todayISO]);

  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const firstDayDow = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
  const leadingBlanks = firstDayDow === 0 ? 6 : firstDayDow - 1;
  const MONTH_NAMES = getRawArray(t, "monthsLowercase");
  const dayHeaders = getRawArray(t, "dayHeaders");
  const hasAssignments = assignments.length > 0;

  return (
    <>
      <div className="space-y-8 lg:grid lg:grid-cols-[1fr_1px_1fr] lg:gap-8 lg:space-y-0">
          {/* Left column: assignments + calendar */}
          <div className="space-y-8">
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
                          onClick={() => { if (hasAny) startTransition(() => setCalendarSelectedDate(dateStr)); }}
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

          <div className="hidden lg:block bg-border" />

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

      <Dialog.Root
        open={!!calendarSelectedDate}
        onOpenChange={(v) => { if (!v) setCalendarSelectedDate(null); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background shadow-lg focus:outline-none"
            aria-describedby="calendar-detail-description"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={() => setCalendarSelectedDate(null)}
          >
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
                  {calendarSelectedDate ? formatDateLong(calendarSelectedDate) : ""}
                </Dialog.Title>
                {calendarSelectedDate && conflictDateSet.has(calendarSelectedDate) && (
                  <p className="text-xs text-destructive mt-0.5">{t("conflict")}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCalendarSelectedDate(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t("close")}
              >
                ✕
              </button>
            </div>

            <Dialog.Description className="sr-only" id="calendar-detail-description">
              {calendarSelectedDate ? formatDateLong(calendarSelectedDate) : ""}
            </Dialog.Description>

            <div className="px-6 py-4 space-y-2">
              {calendarDateConflictContent && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 mb-3 space-y-1">
                  <p className="text-xs font-medium text-destructive uppercase tracking-wide">
                    {t("conflict")}
                  </p>
                  {calendarDateConflictContent.map((ts, idx) => (
                    <p key={idx} className="text-sm text-foreground">
                      {ts.groupNames.join(" · ")}: {utcTimeToLocalDisplay(ts.startUtc)}–{utcTimeToLocalDisplay(ts.endUtc)}
                    </p>
                  ))}
                </div>
              )}
              {calendarDateDetailRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noAssignments")}</p>
              ) : (
                <>
                  {calendarDateDetailRows.map((row) => (
                    <div
                      key={`${calendarSelectedDate}-${row.groupSlug}`}
                      className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">
                        {row.roles.join(", ")}
                        {row.startTimeUtc != null && row.endTimeUtc != null && (
                          <span className="normal-case ml-1.5 text-muted-foreground">
                            {utcTimeToLocalDisplay(row.startTimeUtc)}–{utcTimeToLocalDisplay(row.endTimeUtc)}
                          </span>
                        )}
                      </span>
                      <Link
                        href={`/${row.groupSlug}/cronograma`}
                        onClick={() => setCalendarSelectedDate(null)}
                        className="text-xs font-medium text-accent hover:opacity-80 transition-opacity"
                      >
                        {row.groupName} &rarr;
                      </Link>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
