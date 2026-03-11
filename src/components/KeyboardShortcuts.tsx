"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";

const SEQUENCE_TIMEOUT_MS = 1200;

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("shortcuts");
  const tCommon = useTranslations("common");

  const clearSequence = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingG(false);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
    clearSequence();
  }, [clearSequence]);

  useHotkeys("shift+/", () => setShowHelp(true), { enableOnFormTags: false });
  useHotkeys("escape", () => {
    closeHelp();
  }, { enableOnFormTags: true });
  useHotkeys("g", () => {
    clearSequence();
    setPendingG(true);
    timeoutRef.current = setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
  }, { enableOnFormTags: false, keydown: true });
  useHotkeys("h", () => {
    if (pendingG) {
      clearSequence();
      setShowHelp(false);
      router.push("/");
    }
  }, { enableOnFormTags: false }, [pendingG, router]);
  useHotkeys("a", () => {
    if (pendingG) {
      clearSequence();
      setShowHelp(false);
      router.push("/asignaciones");
    }
  }, { enableOnFormTags: false }, [pendingG, router]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return (
    <Dialog.Root open={showHelp} onOpenChange={(v) => { if (!v) closeHelp(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background shadow-lg focus:outline-none"
          aria-describedby="shortcuts-description"
          onEscapeKeyDown={closeHelp}
        >
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
            <Dialog.Title className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase">
              {t("title")}
            </Dialog.Title>
            <button
              type="button"
              onClick={closeHelp}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={tCommon("close")}
            >
              ✕
            </button>
          </div>

          <Dialog.Description className="sr-only" id="shortcuts-description">
            {t("title")}
          </Dialog.Description>

          <ul className="px-6 py-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex justify-between gap-4">
              <span>?</span>
              <span>{t("title")}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="font-mono">g</span>
              <span>{t("pressGThen")}</span>
            </li>
            <li className="pl-4 flex justify-between gap-4">
              <span className="font-mono">h</span>
              <span>{t("goToHome")}</span>
            </li>
            <li className="pl-4 flex justify-between gap-4">
              <span className="font-mono">a</span>
              <span>{t("goToAssignments")}</span>
            </li>
            <li className="flex justify-between gap-4 pt-2 border-t border-border">
              <span className="font-mono">⌘K</span>
              <span>{t("goToSearch")}</span>
            </li>
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
