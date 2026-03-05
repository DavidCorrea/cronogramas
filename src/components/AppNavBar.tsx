"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { getSnapshot, subscribe, setTheme, getMountedSnapshot, subscribeMounted } from "@/lib/theme";

const HIDDEN_PATHS = ["/login"];

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

export default function AppNavBar() {
  const { data: session, status, update: updateSession } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const darkMode = useSyncExternalStore(subscribe, getSnapshot, () => true);
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, () => false);
  const t = useTranslations("nav");

  if (HIDDEN_PATHS.some((p) => pathname === p)) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      {(session as { realUserId?: string } | null)?.realUserId && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center justify-center gap-3 flex-wrap">
          <span className="text-xs text-foreground">
            {t("actingAs", { name: session?.user?.name ?? session?.user?.email ?? "?" })}
          </span>
          <button
            type="button"
            onClick={async () => {
              await updateSession({ impersonatedUserId: null });
              window.location.href = "/";
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("stopImpersonating")}
          </button>
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] font-semibold text-lg uppercase tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            {t("appName")}
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/"
              className={`text-sm transition-colors rounded-md px-2 py-1.5 ${pathname === "/" ? "text-foreground font-medium bg-muted" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("home")}
            </Link>
            {session?.user && (
              <Link
                href="/asignaciones"
                className={`text-sm transition-colors rounded-md px-2 py-1.5 ${pathname === "/asignaciones" ? "text-foreground font-medium bg-muted" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("myAssignments")}
              </Link>
            )}
            {/* Theme toggle: pill with sun/moon */}
            <div
              className="flex items-center rounded-full border border-border bg-muted/50 p-0.5"
              role="group"
              aria-label={t("toggleTheme")}
            >
              <button
                onClick={() => setTheme(false)}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${!darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={mounted ? !darkMode : undefined}
                aria-label={t("lightMode")}
              >
                <SunIcon className="shrink-0" />
              </button>
              <button
                onClick={() => setTheme(true)}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={mounted ? darkMode : undefined}
                aria-label={t("darkMode")}
              >
                <MoonIcon className="shrink-0" />
              </button>
            </div>
            {status !== "loading" &&
              (session?.user ? (
                <>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1"
                  >
                    {session.user.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover object-center shrink-0 transition-none"
                      />
                    )}
                    <span className="text-xs max-w-[100px] truncate">
                      {session.user.name}
                    </span>
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1 pl-2 border-l border-border"
                  >
                    {t("signOut")}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t("signIn")}
                </Link>
              ))}
          </div>

          {/* Mobile: theme toggle + menu button */}
          <div className="flex md:hidden items-center gap-2">
            <div
              className="flex items-center rounded-full border border-border bg-muted/50 p-0.5"
              role="group"
              aria-label={t("toggleTheme")}
            >
              <button
                onClick={() => setTheme(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${!darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                aria-label={t("lightMode")}
              >
                <SunIcon className="shrink-0" />
              </button>
              <button
                onClick={() => setTheme(true)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                aria-label={t("darkMode")}
              >
                <MoonIcon className="shrink-0" />
              </button>
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t("menu")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-2 pb-3">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm rounded-lg mx-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t("home")}
            </Link>
            {session?.user && (
              <Link
                href="/asignaciones"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm rounded-lg mx-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t("myAssignments")}
              </Link>
            )}
            {status !== "loading" &&
              (session?.user ? (
                <div className="px-3 py-2 flex items-center gap-3 mx-2 rounded-lg bg-muted/30">
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-foreground hover:opacity-80 transition-opacity"
                  >
                    {session.user.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                      <img
                        src={session.user.image}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover object-center shrink-0 transition-none"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{session.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.user.email}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 rounded px-2 py-1"
                  >
                    {t("signOut")}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm rounded-lg mx-2 text-primary font-medium hover:opacity-90"
                >
                  {t("signIn")}
                </Link>
              ))}
          </div>
        )}
      </div>
    </nav>
  );
}
