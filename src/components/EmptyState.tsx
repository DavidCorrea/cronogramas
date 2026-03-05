"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Empty state for config list pages. Short copy + primary CTA.
 * Use when there are no members, roles, events, or schedules yet.
 */
export function EmptyState({
  message,
  ctaLabel,
  ctaHref,
  ctaAsButton,
  ctaOnClick,
}: {
  message: string;
  ctaLabel: string;
  ctaHref?: string;
  ctaAsButton?: boolean;
  ctaOnClick?: () => void;
}) {
  const cta: ReactNode =
    ctaAsButton && ctaOnClick ? (
      <button
        type="button"
        onClick={ctaOnClick}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {ctaLabel}
      </button>
    ) : ctaHref ? (
      <Link
        href={ctaHref}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity inline-block"
      >
        {ctaLabel}
      </Link>
    ) : null;

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 py-10 px-6 text-center">
      <p className="text-muted-foreground text-sm mb-5">{message}</p>
      {cta}
    </div>
  );
}
