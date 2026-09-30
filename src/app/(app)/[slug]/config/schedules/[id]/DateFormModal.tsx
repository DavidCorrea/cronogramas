"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { formatDateWeekdayDay } from "@/lib/timezone-utils";

interface DateFormModalBaseProps {
  open: boolean;
  date: string;
  minDate: string;
  maxDate: string;
  startUtc: string;
  endUtc: string;
  note: string;
  dateLabel: string;
  saving: boolean;
  onDateChange: (v: string) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onDateLabelChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}

interface AddModeProps extends DateFormModalBaseProps {
  mode: "add";
  dateType: "assignable" | "for_everyone";
  onDateTypeChange: (v: "assignable" | "for_everyone") => void;
}

interface EditModeProps extends DateFormModalBaseProps {
  mode: "edit";
  originalDate: string;
  onDelete: () => void;
}

type DateFormModalProps = AddModeProps | EditModeProps;

export function DateFormModal(props: DateFormModalProps) {
  const {
    open, date, minDate, maxDate, startUtc, endUtc, note, dateLabel, saving,
    onDateChange, onStartChange, onEndChange, onNoteChange, onDateLabelChange,
    onSave, onClose, t, tCommon, mode,
  } = props;

  const title = mode === "add" ? t("addDateTitle") : t("editDateTitle");
  const description = mode === "add"
    ? t("addDateDescription")
    : formatDateWeekdayDay(date || props.originalDate);
  const saveLabel = mode === "add"
    ? tCommon("add")
    : saving ? t("saving") : t("save");
  const descriptionId = `${mode}-date-description`;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background shadow-lg focus:outline-none"
          aria-describedby={descriptionId}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={onClose}
        >
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
                {title}
              </Dialog.Title>
              <Dialog.Description id={descriptionId} className="text-sm text-muted-foreground mt-1">
                {description}
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

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("dateLabel")}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                min={minDate}
                max={maxDate}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
              />
            </div>

            {mode === "add" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("typeLabel")}</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => props.onDateTypeChange("assignable")}
                    className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                      props.dateType === "assignable"
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {t("typeAssignable")}
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDateTypeChange("for_everyone")}
                    className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                      props.dateType === "for_everyone"
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {t("typeForEveryone")}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("labelLabel")}</label>
              <input
                type="text"
                value={dateLabel}
                onChange={(e) => onDateLabelChange(e.target.value)}
                placeholder={t("labelPlaceholder")}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("startTimeLabel")}</label>
                <input
                  type="time"
                  value={startUtc}
                  onChange={(e) => onStartChange(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("endTimeLabel")}</label>
                <input
                  type="time"
                  value={endUtc}
                  onChange={(e) => onEndChange(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("noteLabel")}</label>
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder={tCommon("optional")}
                rows={2}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full resize-y max-h-32"
              />
            </div>
          </div>

          <div className={`px-6 py-4 border-t border-border flex flex-wrap items-center gap-3 ${mode === "edit" ? "justify-between" : "justify-end"}`}>
            {mode === "edit" && (
              <button
                type="button"
                onClick={props.onDelete}
                className="text-sm text-destructive hover:opacity-80"
              >
                {t("deleteDate")}
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saveLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
