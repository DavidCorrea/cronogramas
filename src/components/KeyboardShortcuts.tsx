"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslations } from "next-intl";

const SEQUENCE_TIMEOUT_MS = 1200;

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useTranslations("shortcuts");

  const clearSequence = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingG(false);
  }, []);

  useHotkeys("shift+/", () => setShowHelp(true), { enableOnFormTags: false });
  useHotkeys("escape", () => {
    setShowHelp(false);
    clearSequence();
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

  const closeHelp = useCallback(() => {
    setShowHelp(false);
    clearSequence();
  }, [clearSequence]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={closeHelp}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-title" className="text-lg font-medium uppercase tracking-wide">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={closeHelp}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Esc
          </button>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
