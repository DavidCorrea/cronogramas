"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { getSnapshot, subscribe, setTheme, getMountedSnapshot, subscribeMounted } from "@/lib/theme";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** Light/dark pill. `large` gives bigger touch targets for mobile layouts. */
export function ThemeToggle({ size = "small" }: { size?: "small" | "large" }) {
  const darkMode = useSyncExternalStore(subscribe, getSnapshot, () => true);
  // aria-pressed stays unset until mount: the server can't know the theme.
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, () => false);
  const t = useTranslations("nav");
  const buttonSize = size === "large" ? "h-8 w-8" : "h-7 w-7";
  const buttonClassName = (isActive: boolean) =>
    `flex ${buttonSize} items-center justify-center rounded-full transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div
      className="flex items-center rounded-full border border-border bg-muted/50 p-0.5"
      role="group"
      aria-label={t("toggleTheme")}
    >
      <button
        onClick={() => setTheme(false)}
        className={buttonClassName(!darkMode)}
        aria-pressed={mounted ? !darkMode : undefined}
        aria-label={t("lightMode")}
      >
        <SunIcon className="shrink-0" />
      </button>
      <button
        onClick={() => setTheme(true)}
        className={buttonClassName(darkMode)}
        aria-pressed={mounted ? darkMode : undefined}
        aria-label={t("darkMode")}
      >
        <MoonIcon className="shrink-0" />
      </button>
    </div>
  );
}
