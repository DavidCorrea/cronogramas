"use client";

import { formatDateShort as formatDate } from "@/lib/timezone-utils";

interface RebuildEntry {
  date: string;
  roleId: number;
  roleName: string;
  memberId: number;
  memberName: string;
}

interface RebuildModalProps {
  rebuildMode: "overwrite" | "fill_empty" | null;
  rebuildLoading: boolean;
  rebuildPreview: RebuildEntry[] | null;
  rebuildRemovedCount: number;
  onPreview: (mode: "overwrite" | "fill_empty") => void;
  onApply: () => void;
  onClose: () => void;
  t: (key: string, values?: { n?: number }) => string;
  tCommon: (key: string) => string;
}

export function RebuildModal({
  rebuildMode,
  rebuildLoading,
  rebuildPreview,
  rebuildRemovedCount,
  onPreview,
  onApply,
  onClose,
  t,
  tCommon,
}: RebuildModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
            {t("rebuildModalTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("rebuildModalSubtitle")}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!rebuildMode && (
            <div className="space-y-3">
              <button
                onClick={() => onPreview("overwrite")}
                className="w-full rounded-md border border-border p-4 text-left hover:border-foreground transition-colors"
              >
                <p className="text-sm font-medium">{t("rebuildOverwrite")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("rebuildOverwriteHelp")}
                </p>
              </button>
              <button
                onClick={() => onPreview("fill_empty")}
                className="w-full rounded-md border border-border p-4 text-left hover:border-foreground transition-colors"
              >
                <p className="text-sm font-medium">{t("rebuildFillEmpty")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("rebuildFillEmptyHelp")}
                </p>
              </button>
            </div>
          )}

          {rebuildLoading && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("generatingPreview")}
            </p>
          )}

          {rebuildPreview && !rebuildLoading && (
            <div className="space-y-4">
              {rebuildRemovedCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("willReplaceAssignments", { n: rebuildRemovedCount })}
                </p>
              )}
              {rebuildPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("noNewAssignments")}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {(() => {
                    const grouped = new Map<string, RebuildEntry[]>();
                    for (const entry of rebuildPreview) {
                      const list = grouped.get(entry.date) ?? [];
                      list.push(entry);
                      grouped.set(entry.date, list);
                    }
                    return [...grouped.entries()].map(([date, entries]) => (
                      <div key={date} className="py-3 first:pt-0">
                        <p className="text-sm font-medium mb-1.5">{formatDate(date)}</p>
                        <div className="space-y-1">
                          {entries.map((e) => (
                            <div key={`${e.date}-${e.roleId}-${e.memberId}`} className="flex justify-between text-sm">
                              <span className="text-muted-foreground text-xs uppercase tracking-wide">{e.roleName}</span>
                              <span>{e.memberName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
          >
            {tCommon("cancel")}
          </button>
          {rebuildPreview && rebuildPreview.length > 0 && (
            <button
              onClick={onApply}
              disabled={rebuildLoading}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {rebuildLoading ? t("applying") : t("apply")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
