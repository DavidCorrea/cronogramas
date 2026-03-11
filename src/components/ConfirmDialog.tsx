"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  /** When true, confirm button shows loading state and is disabled */
  loading?: boolean;
}

/**
 * Accessible confirmation dialog using Radix Dialog (focus trap, aria-modal,
 * keyboard). Use for destructive actions instead of window.confirm().
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  onConfirm,
  destructive = true,
  loading = false,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background shadow-lg focus:outline-none"
          aria-describedby="confirm-dialog-description"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
                {title}
              </Dialog.Title>
              <Dialog.Description
                id="confirm-dialog-description"
                className="text-sm text-muted-foreground mt-1"
              >
                {message}
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("close")}
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-4 flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirm}
              className={
                destructive
                  ? "rounded-md bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  : "rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              }
            >
              {loading ? "…" : (confirmLabel ?? t("delete"))}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
