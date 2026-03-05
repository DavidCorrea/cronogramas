"use client";

import { ConfigContentSkeleton, RootLoadingSkeleton, SkeletonText } from "@/components/Skeletons";

/**
 * Loading placeholder using skeletons only (no spinner).
 * fullPage: dashboard-style skeleton; otherwise config-style list skeleton.
 * Keeps same API (message, fullPage, compact) for callers; message/compact only affect compact variant.
 */
export default function LoadingScreen({
  fullPage = true,
  compact = false,
}: {
  message?: string;
  fullPage?: boolean;
  /** Inline variant for nav bars: no min-height, small skeleton */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className="min-h-0 flex flex-row items-center justify-center gap-2 py-0"
        role="status"
        aria-live="polite"
        aria-label="Cargando…"
      >
        <SkeletonText lines={1} className="h-4 w-24" />
      </div>
    );
  }

  if (fullPage) {
    return <RootLoadingSkeleton />;
  }

  return (
    <div className="min-h-[14rem] py-12" role="status" aria-label="Cargando…">
      <ConfigContentSkeleton />
    </div>
  );
}
