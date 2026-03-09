"use client";

import { formatDateLong } from "@/lib/timezone-utils";
import { getRelativeLabel } from "./types";
import type { ScheduleDateInfo } from "./types";

interface MemberAgendaCardProps {
  memberName: string;
  assignedDateCount: number;
  upcomingDate: string | null;
  today: string;
  getNonDependentRolesForDate: (date: string) => string;
  hasDependentRoleOnDate: (date: string) => boolean;
  getDependentRoleNamesOnDate: (date: string) => string[];
  getNoteForScheduleDate: (sd: ScheduleDateInfo) => string | undefined;
  scheduleDateByDateMap: Map<string, ScheduleDateInfo>;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function MemberAgendaCard({
  memberName,
  assignedDateCount,
  upcomingDate,
  today,
  getNonDependentRolesForDate,
  hasDependentRoleOnDate,
  getDependentRoleNamesOnDate,
  getNoteForScheduleDate,
  scheduleDateByDateMap,
  t,
}: MemberAgendaCardProps) {
  const upcomingSd = upcomingDate
    ? scheduleDateByDateMap.get(upcomingDate) ?? { date: upcomingDate, type: "assignable" as const }
    : null;

  return (
    <>
      {/* Mobile card */}
      <div className="mb-8 border border-foreground/20 rounded-md p-5 lg:hidden">
        <h2 className="text-lg font-medium">
          {t("agendaOf", { name: memberName })}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {assignedDateCount}{" "}
          {assignedDateCount === 1 ? t("dateAssigned") : t("datesAssigned")}
        </p>
        {upcomingDate && upcomingSd && (
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
            {getNoteForScheduleDate(upcomingSd) && (
              <p className="text-xs text-accent mt-2">
                {getNoteForScheduleDate(upcomingSd)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Desktop card */}
      <div className="hidden lg:block">
        <div className="mb-8 border-b border-border pb-6">
          <h2 className="text-lg font-medium">
            {t("agendaOf", { name: memberName })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {assignedDateCount}{" "}
            {assignedDateCount === 1 ? t("dateAssigned") : t("datesAssigned")}
          </p>
        </div>
        {upcomingDate && upcomingSd && (
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
            {getNoteForScheduleDate(upcomingSd) && (
              <p className="text-xs text-accent mt-2">
                {getNoteForScheduleDate(upcomingSd)}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
