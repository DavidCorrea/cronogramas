"use client";

import React, { memo } from "react";
import {
  formatDateWeekdayDay,
} from "@/lib/timezone-utils";
import type { ScheduleDateInfo, ScheduleEntry } from "./types";
import { getDateDisplayTimeRange } from "./helpers";

interface DesktopTableProps {
  datesByWeek: { weekNumber: number; dates: string[] }[];
  roleOrder: { id: number; name: string }[];
  filteredRoleId: number | null;
  filteredMemberId: number | null;
  entries: ScheduleEntry[];
  scheduleDateByDateMap: Map<string, ScheduleDateInfo>;
  forEveryoneSet: Set<string>;
  collapsedWeeks: Set<number>;
  toggleWeek: (weekNumber: number) => void;
  weekDateRangeLabel: (weekNumber: number) => string;
  desktopContainerWidth: number;
  getDateDisplayLabel: (sd: ScheduleDateInfo) => string;
  getNoteForScheduleDate: (sd: ScheduleDateInfo) => string | undefined;
  hasConflict: (date: string, memberId: number) => boolean;
  isPast: (date: string) => boolean;
  t: (key: string) => string;
}

function DesktopTableInner({
  datesByWeek,
  roleOrder,
  filteredRoleId,
  filteredMemberId,
  entries,
  scheduleDateByDateMap,
  forEveryoneSet,
  collapsedWeeks,
  toggleWeek,
  weekDateRangeLabel,
  desktopContainerWidth,
  getDateDisplayLabel,
  getNoteForScheduleDate,
  hasConflict,
  isPast,
  t,
}: DesktopTableProps) {
  const visibleRoles = filteredRoleId
    ? roleOrder.filter((r) => r.id === filteredRoleId)
    : roleOrder;

  const COL_MIN_WIDTH = 130;
  const DATE_COL_WIDTH = 170;
  const estimatedTableWidth =
    visibleRoles.length * COL_MIN_WIDTH + DATE_COL_WIDTH;
  const useCardLayout =
    desktopContainerWidth > 0 &&
    estimatedTableWidth > desktopContainerWidth;

  const renderMemberName = (
    memberId: number,
    memberName: string,
    date: string,
  ) => (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ${filteredMemberId === memberId ? "font-bold text-foreground" : "font-medium"}`}
    >
      {memberName}
      {hasConflict(date, memberId) && (
        <span
          className="text-amber-500 shrink-0"
          title={t("conflictWithHolidays")}
        >
          ⚠
        </span>
      )}
    </span>
  );

  const hasFilteredMember = (roleEntries: ScheduleEntry[]) =>
    filteredMemberId != null &&
    roleEntries.some((e) => e.memberId === filteredMemberId);

  return (
    <>
      {datesByWeek.map(({ weekNumber, dates }) => {
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
              <span className="text-muted-foreground shrink-0" aria-hidden>
                {isCollapsed ? "▶" : "▼"}
              </span>
            </button>
            {!isCollapsed && useCardLayout && (
              <div className="divide-y divide-border">
                {dates.map((date) => {
                  const sd = scheduleDateByDateMap.get(date) ?? {
                    date,
                    type: "assignable" as const,
                  };
                  const isForEveryone = forEveryoneSet.has(date);
                  const entriesOnDate = entries.filter(
                    (e) =>
                      e.date === date &&
                      (!filteredRoleId || e.roleId === filteredRoleId),
                  );
                  const note = getNoteForScheduleDate(sd);
                  const label = !isForEveryone
                    ? getDateDisplayLabel(sd)
                    : null;
                  const timeRange = getDateDisplayTimeRange(sd);
                  return (
                    <div
                      key={date}
                      className={`px-4 py-3.5 ${isPast(date) ? "opacity-50" : ""} ${isForEveryone ? "bg-muted/20" : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm">
                          {formatDateWeekdayDay(date)}
                        </span>
                        {label && (
                          <span className="text-xs text-muted-foreground italic shrink-0">
                            {label}
                          </span>
                        )}
                      </div>
                      {timeRange && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeRange}
                        </p>
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
                                const roleEntries = entriesOnDate.filter(
                                  (e) => e.roleId === role.id,
                                );
                                if (roleEntries.length === 0) return null;
                                return (
                                  <tr
                                    key={role.id}
                                    className={`border-b border-border/40 last:border-b-0 ${hasFilteredMember(roleEntries) ? "bg-primary/10" : ""}`}
                                  >
                                    <td className="px-3 py-1.5 text-xs font-medium text-muted-foreground align-top w-1/3">
                                      {role.name}
                                    </td>
                                    <td className="px-3 py-1.5 align-top">
                                      {roleEntries.length === 1 ? (
                                        renderMemberName(
                                          roleEntries[0].memberId,
                                          roleEntries[0].memberName,
                                          date,
                                        )
                                      ) : (
                                        <span className="flex flex-col gap-0.5">
                                          {[...roleEntries]
                                            .sort((a, b) =>
                                              a.memberName.localeCompare(
                                                b.memberName,
                                                "es",
                                              ),
                                            )
                                            .map((e) => (
                                              <React.Fragment key={e.id}>
                                                {renderMemberName(
                                                  e.memberId,
                                                  e.memberName,
                                                  date,
                                                )}
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
                      const sd = scheduleDateByDateMap.get(date) ?? {
                        date,
                        type: "assignable" as const,
                      };
                      const isForEveryone = forEveryoneSet.has(date);
                      const entriesOnDate = entries.filter(
                        (e) =>
                          e.date === date &&
                          (!filteredRoleId || e.roleId === filteredRoleId),
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
                            <div>{formatDateWeekdayDay(date)}</div>
                            {!isForEveryone && getDateDisplayLabel(sd) && (
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
                              const roleEntries = entriesOnDate.filter(
                                (e) => e.roleId === role.id,
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
                                    renderMemberName(
                                      roleEntries[0].memberId,
                                      roleEntries[0].memberName,
                                      date,
                                    )
                                  ) : (
                                    <span className="text-xs">
                                      {[...roleEntries]
                                        .sort((a, b) =>
                                          a.memberName.localeCompare(
                                            b.memberName,
                                            "es",
                                          ),
                                        )
                                        .map((e, i) => (
                                          <React.Fragment key={e.id}>
                                            {i > 0 && (
                                              <span className="text-muted-foreground">
                                                ,{" "}
                                              </span>
                                            )}
                                            {renderMemberName(
                                              e.memberId,
                                              e.memberName,
                                              date,
                                            )}
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
}

export const DesktopTable = memo(DesktopTableInner);
