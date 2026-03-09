"use client";

import { formatDateWeekdayDay } from "@/lib/timezone-utils";

interface EditDateModalProps {
  date: string;
  startUtc: string;
  endUtc: string;
  note: string;
  saving: boolean;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}

export function EditDateModal({
  date,
  startUtc,
  endUtc,
  note,
  saving,
  onStartChange,
  onEndChange,
  onNoteChange,
  onSave,
  onDelete,
  onClose,
  t,
  tCommon,
}: EditDateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
            {t("editDateTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateWeekdayDay(date)}
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("startTimeLabel")}</label>
              <input
                type="time"
                value={startUtc}
                onChange={(e) => onStartChange(e.target.value)}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
              />
              <p className="text-xs text-muted-foreground mt-0.5">{t("yourTimezone")}</p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("endTimeLabel")}</label>
              <input
                type="time"
                value={endUtc}
                onChange={(e) => onEndChange(e.target.value)}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
              />
              <p className="text-xs text-muted-foreground mt-0.5">{t("yourTimezone")}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("noteLabel")}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={tCommon("optional")}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onDelete}
            className="text-sm text-destructive hover:opacity-80"
          >
            {t("deleteDate")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
            >
              {tCommon("cancel")}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
