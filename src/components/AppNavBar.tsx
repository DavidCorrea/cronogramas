"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

const HIDDEN_PATHS = ["/login"];

export default function AppNavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const t = useTranslations("nav");

  useEffect(() => {
    queueMicrotask(() => {
      const stored = localStorage.getItem("band-scheduler-theme");
      if (stored) {
        setDarkMode(stored === "dark");
      } else {
        setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    });
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.add("light");
      html.classList.remove("dark");
    }
    localStorage.setItem("band-scheduler-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  if (HIDDEN_PATHS.some((p) => pathname === p)) return null;

  return (
    <nav className="border-b border-border sticky top-0 z-50 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg uppercase tracking-tight hover:opacity-80 transition-opacity"
          >
            {t("appName")}
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-border hover:border-foreground transition-colors"
              aria-label={t("toggleTheme")}
            >
              <span className="text-sm leading-none">{darkMode ? "☀️" : "🌙"}</span>
            </button>
            {status !== "loading" &&
              (session?.user ? (
                <>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
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
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2 pl-2 border-l border-border"
                  >
                    {t("signOut")}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("signIn")}
                </Link>
              ))}
          </div>

          {/* Mobile: theme toggle + menu button */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-border hover:border-foreground transition-colors"
              aria-label={t("toggleTheme")}
            >
              <span className="text-sm leading-none">{darkMode ? "☀️" : "🌙"}</span>
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2.5 text-muted-foreground hover:text-foreground transition-colors"
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
            {status !== "loading" &&
              (session?.user ? (
                <div className="px-3 py-2 flex items-center gap-3">
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
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {t("signOut")}
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
