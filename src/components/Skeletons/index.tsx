"use client";

import type { ReactNode } from "react";

/**
 * Shared skeleton primitives for loading states.
 * Use Tailwind animate-pulse and bg-muted so all skeletons share the same look and respect theme.
 * Wrap skeleton regions in SkeletonRegion for aria-busy and aria-label (a11y).
 */

const skeletonClass = "animate-pulse rounded bg-muted";

export function SkeletonText({
  className = "",
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 ${skeletonClass} ${i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonRow({
  className = "",
  avatar = true,
  lines = 2,
}: {
  className?: string;
  avatar?: boolean;
  lines?: number;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      aria-hidden
    >
      {avatar && (
        <div className={`h-10 w-10 shrink-0 rounded-full ${skeletonClass}`} />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`h-4 ${skeletonClass} w-full`} />
        {lines >= 2 && (
          <div className={`h-3 ${skeletonClass} w-2/3`} />
        )}
        {lines >= 3 && (
          <div className={`h-3 ${skeletonClass} w-1/2`} />
        )}
      </div>
    </div>
  );
}

export function SkeletonCard({
  className = "",
  height = "h-20",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border p-4 ${height} flex flex-col justify-center gap-3 ${className}`}
      aria-hidden
    >
      <div className={`h-4 ${skeletonClass} w-2/3`} />
      <div className={`h-3 ${skeletonClass} w-1/2`} />
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  className = "",
  cardHeight = "h-20",
}: {
  count?: number;
  className?: string;
  cardHeight?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={cardHeight} />
      ))}
    </div>
  );
}

/**
 * Wraps a skeleton region with aria-busy and aria-label so screen readers announce loading.
 * Remove or replace with real content when data is ready.
 */
export function SkeletonRegion({
  "aria-label": ariaLabel = "Cargando…",
  children,
  className = "",
}: {
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      aria-busy="true"
      aria-label={ariaLabel}
      role="status"
    >
      {children}
    </div>
  );
}
