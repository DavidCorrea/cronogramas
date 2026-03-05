"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import { isConfigFormPageWithUnsavedGuard } from "@/lib/config-nav-guard";
import ConfigGoTo from "@/components/ConfigGoTo";

/**
 * Config sub-nav: group name and links to members, roles, events, etc.
 * Used inside ConfigLayoutClient (after GroupProvider); with server-injected initial data, loading is false on first paint.
 */
export default function ConfigLayoutInner() {
  const { slug, groupName, loading, error } = useGroup();
  const pathname = usePathname();
  const router = useRouter();
  const { dirty: configDirty, setDirty } = useUnsavedConfig();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tNav = useTranslations("configNav");
  const tGlobal = useTranslations("nav");

  // Clear dirty when navigating to a page that doesn't use the unsaved guard (e.g. events list, members list).
  // Otherwise the banner would stay visible after leaving a form page.
  useEffect(() => {
    if (!isConfigFormPageWithUnsavedGuard(pathname ?? null)) {
      setDirty(false);
    }
  }, [pathname, setDirty]);

  const navLinks: { href: string; label: string; exact?: boolean }[] = [
    { href: `/${slug}/config/members`, label: tNav("members") },
    { href: `/${slug}/config/roles`, label: tNav("roles") },
    { href: `/${slug}/config/events`, label: tNav("events") },
    { href: `/${slug}/config/holidays`, label: tNav("holidays") },
    { href: `/${slug}/config/collaborators`, label: tNav("collaborators") },
    { href: `/${slug}/config/schedules`, label: tNav("schedules") },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const isFormPageWithGuard = isConfigFormPageWithUnsavedGuard(pathname ?? null);
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string): boolean => {
    if (isFormPageWithGuard && configDirty && href !== pathname) {
      e.preventDefault();
      if (window.confirm(tNav("unsavedConfirm"))) {
        setMobileOpen(false);
        router.push(href);
        return true;
      }
      return false;
    }
    return true;
  };

  if (loading) {
    return (
      <nav className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-12" />
      </nav>
    );
  }

  if (error) {
    return (
      <nav className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-12 items-center">
            <span className="text-destructive text-sm">{tNav("groupNotFound")}</span>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b border-border bg-background sticky top-14 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href={`/${slug}/config`}
              onClick={(e) => handleNavClick(e, `/${slug}/config`)}
              className="text-sm font-medium text-foreground truncate uppercase tracking-wide hover:opacity-80 transition-opacity"
            >
              {groupName}
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <ConfigGoTo />
            {navLinks.map((link) => {
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    active
                      ? "text-accent bg-accent/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={tGlobal("sectionMenu")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-2 pb-3">
            {navLinks.map((link) => {
              const active = isActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    if (handleNavClick(e, link.href)) setMobileOpen(false);
                  }}
                  className={`block px-3 py-2.5 text-sm font-medium rounded-lg mx-2 transition-colors ${
                    active
                      ? "text-accent bg-accent/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
