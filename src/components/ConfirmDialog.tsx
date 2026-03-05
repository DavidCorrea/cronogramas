"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
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
  cancelLabel,
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-card p-6 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="confirm-dialog-description"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <Dialog.Title className="text-lg font-medium text-foreground">
            {title}
          </Dialog.Title>
          <Dialog.Description
            id="confirm-dialog-description"
            className="mt-2 text-sm text-muted-foreground"
          >
            {message}
          </Dialog.Description>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirm}
              className={
                destructive
                  ? "rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                  : "rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              }
            >
              {loading ? "…" : (confirmLabel ?? t("delete"))}
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={loading}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {cancelLabel ?? t("cancel")}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
