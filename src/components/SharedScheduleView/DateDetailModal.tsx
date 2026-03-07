"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { formatDateLong } from "@/lib/timezone-utils";
import type {
  ScheduleDateInfo,
  SharedScheduleData,
} from "./types";

export interface DateDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string | null;
  schedule: SharedScheduleData;
  roleOrder: { id: number; name: string }[];
  scheduleDateByDateMap: Map<string, ScheduleDateInfo>;
  getDateDisplayLabel: (sd: ScheduleDateInfo) => string;
  getDateDisplayTimeRange: (sd: ScheduleDateInfo) => string | null;
  getNoteForScheduleDate: (sd: ScheduleDateInfo) => string | undefined;
  hasConflict: (date: string, memberId: number) => boolean;
  filteredMemberId?: number | null;
  t: (key: string) => string;
}

export function DateDetailModal({
  open,
  onOpenChange,
  selectedDate,
  schedule,
  roleOrder,
  scheduleDateByDateMap,
  getDateDisplayLabel,
  getDateDisplayTimeRange,
  getNoteForScheduleDate,
  hasConflict,
  filteredMemberId,
  t,
}: DateDetailModalProps) {
  if (!selectedDate) return null;

  const sd =
    scheduleDateByDateMap.get(selectedDate) ?? ({
      date: selectedDate,
      type: "assignable" as const,
    });
  const isForEveryone = sd.type === "for_everyone";
  const label = getDateDisplayLabel(sd) || (isForEveryone ? "Ensayo" : "");
  const timeRange = getDateDisplayTimeRange(sd);
  const entriesOnDate = schedule.entries.filter((e) => e.date === selectedDate);
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 flex max-h-[90vh] w-full max-w-sm translate-x-[-50%] translate-y-[-50%] flex-col rounded-lg border border-border bg-background p-5 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby={hasContent ? "date-detail-description" : undefined}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="flex shrink-0 items-start justify-between pb-4">
            <Dialog.Title className="font-medium capitalize text-foreground">
              {formatDateLong(selectedDate)}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none ml-3"
                aria-label="Cerrar"
              >
                &times;
              </button>
            </Dialog.Close>
          </div>

          {hasContent ? (
            <div
              id="date-detail-description"
              className="flex min-h-0 flex-1 flex-col overflow-hidden pt-4"
            >
              {label ? (
                <p className="shrink-0 text-sm text-muted-foreground italic">
                  {label}
                </p>
              ) : null}
              {timeRange ? (
                <p className="shrink-0 text-xs text-muted-foreground mt-0.5">
                  {timeRange}
                </p>
              ) : null}
              {rolesSorted.length > 0 ? (
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-border/40">
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {rolesSorted.map(({ roleId, name }) => {
                        const members = entriesOnDate
                          .filter((e) => e.roleId === roleId)
                          .map((e) => ({
                            memberId: e.memberId,
                            name: e.memberName,
                            hasConflict: hasConflict(selectedDate, e.memberId),
                          }));
                        const hasFiltered = filteredMemberId != null && members.some((m) => m.memberId === filteredMemberId);
                        return (
                          <tr
                            key={roleId}
                            className={`border-b border-border/40 last:border-b-0 ${hasFiltered ? "bg-primary/10" : ""}`}
                          >
                            <td className="px-3 py-2 font-medium text-muted-foreground align-top">
                              {name}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {members.length === 1 ? (
                                <span className={`flex items-center gap-1 ${filteredMemberId === members[0].memberId ? "font-bold text-foreground" : ""}`}>
                                  {members[0].name}
                                  {members[0].hasConflict && (
                                    <span
                                      className="text-amber-500 shrink-0"
                                      title={t("conflictWithHolidays")}
                                    >
                                      ⚠
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="flex flex-col gap-0.5 text-sm">
                                  {[...members]
                                    .sort((a, b) =>
                                      a.name.localeCompare(b.name, "es")
                                    )
                                    .map((m) => (
                                      <span
                                        key={m.memberId}
                                        className={`inline-flex items-center gap-0.5 ${filteredMemberId === m.memberId ? "font-bold text-foreground" : ""}`}
                                      >
                                        {m.name}
                                        {m.hasConflict && (
                                          <span
                                            className="text-amber-500 shrink-0"
                                            title={t("conflictWithHolidays")}
                                          >
                                            ⚠
                                          </span>
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
              {note ? (
                <p className="mt-3 shrink-0 border-t border-border/50 pt-3 text-xs text-accent">
                  {note}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" id="date-detail-description">
              {t("noDetails")}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
