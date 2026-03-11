"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
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
  hasConflict,
  filteredMemberId,
  t,
}: DateDetailModalProps) {
  const tCommon = useTranslations("common");

  if (!selectedDate) return null;

  const sd =
    scheduleDateByDateMap.get(selectedDate) ?? ({
      date: selectedDate,
      type: "assignable" as const,
    });
  const label = getDateDisplayLabel(sd);
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
  const note = sd.note?.trim() || null;
  const hasContent = label || timeRange || rolesSorted.length > 0 || note;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-sm translate-x-[-50%] translate-y-[-50%] flex-col rounded-lg border border-border bg-background shadow-lg focus:outline-none"
          aria-describedby={hasContent ? "date-detail-description" : undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="px-6 py-4 border-b border-border flex shrink-0 items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
                {formatDateLong(selectedDate)}
              </Dialog.Title>
              {timeRange && (
                <p className="text-sm text-muted-foreground mt-1">{timeRange}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={tCommon("close")}
            >
              ✕
            </button>
          </div>

          {hasContent ? (
            <div
              id="date-detail-description"
              className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4"
            >
              {label ? (
                <p className="shrink-0 text-sm text-muted-foreground italic">
                  {label}
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
            <p className="px-6 py-4 text-sm text-muted-foreground" id="date-detail-description">
              {t("noDetails")}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
