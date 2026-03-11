"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { formatDateShort as formatDate } from "@/lib/timezone-utils";

interface RebuildEntry {
  date: string;
  roleId: number;
  roleName: string;
  memberId: number;
  memberName: string;
}

interface RebuildModalProps {
  open: boolean;
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
  open,
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
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background shadow-lg max-h-[80vh] flex flex-col focus:outline-none"
          aria-describedby="rebuild-description"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={onClose}
        >
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
                {t("rebuildModalTitle")}
              </Dialog.Title>
              <Dialog.Description id="rebuild-description" className="text-sm text-muted-foreground mt-1">
                {t("rebuildModalSubtitle")}
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={tCommon("close")}
            >
              ✕
            </button>
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

          {rebuildPreview && rebuildPreview.length > 0 && (
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={onApply}
                disabled={rebuildLoading}
                className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {rebuildLoading ? t("applying") : t("apply")}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
