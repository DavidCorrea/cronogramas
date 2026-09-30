import { SkeletonRegion } from "@/components/Skeletons";
import { MONTH_NAMES } from "@/components/SharedScheduleView/types";

/**
 * Route-level loading UI for [slug]/cronograma/[year]/[month].
 * When groupName/month/year are provided (Suspense fallback from page.tsx),
 * renders a real header matching MonthHeader's layout so the user sees the
 * group name and month instantly. Falls back to generic pulse bars when
 * rendered as automatic route-level loading (no props).
 */
export default function CronogramaLoading({
  groupName,
  month,
  year,
}: {
  groupName?: string;
  month?: number;
  year?: number;
} = {}) {
  const hasHeader = groupName != null && month != null && year != null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {hasHeader ? (
        <header className="border-b border-border sticky top-0 z-10 bg-background">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground/40 cursor-default">
                ←
              </span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  {groupName}
                </p>
                <h1 className="font-[family-name:var(--font-display)] font-semibold text-2xl sm:text-3xl uppercase">
                  {MONTH_NAMES[month - 1]} {year}
                </h1>
              </div>
              <span className="text-sm text-muted-foreground/40 cursor-default">
                →
              </span>
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="hidden sm:flex flex-row gap-2">
                <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden />
                <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden />
              </div>
              <div className="h-9 w-[140px] animate-pulse rounded-lg bg-muted" aria-hidden />
            </div>
          </div>
        </header>
      ) : (
        <div className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="h-8 w-48 animate-pulse rounded bg-muted" aria-hidden />
              <div className="flex gap-2">
                <div className="h-9 w-24 animate-pulse rounded bg-muted" aria-hidden />
                <div className="h-9 w-24 animate-pulse rounded bg-muted" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      )}

      <SkeletonRegion className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="mb-8 border border-border rounded-lg overflow-hidden bg-muted/5"
          >
            <div className="px-4 py-2.5 border-b border-border bg-muted/20">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" aria-hidden />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="px-4 py-3.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted mb-2" aria-hidden />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" aria-hidden />
                </div>
              ))}
            </div>
          </div>
        ))}
      </SkeletonRegion>
    </div>
  );
}
