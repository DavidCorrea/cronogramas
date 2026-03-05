import { SkeletonRegion } from "@/components/Skeletons";

/**
 * Route-level loading UI for [slug]/cronograma/[year]/[month].
 * Mirrors the schedule grid: month header + week rows with cell placeholders.
 */
export default function CronogramaLoading() {
  return (
    <SkeletonRegion
      className="min-h-[calc(100dvh-3.5rem)] bg-background text-foreground px-4 py-6 sm:px-6"
      aria-label="Cargando…"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" aria-hidden />
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded bg-muted" aria-hidden />
            <div className="h-9 w-24 animate-pulse rounded bg-muted" aria-hidden />
          </div>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-8 gap-px bg-border">
            <div className="bg-muted/50 p-2" aria-hidden />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-muted/30 p-2 h-8 animate-pulse" aria-hidden />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="grid grid-cols-8 gap-px bg-border">
              <div className="bg-muted/30 p-2 h-12 animate-pulse" aria-hidden />
              {Array.from({ length: 7 }).map((_, col) => (
                <div key={col} className="bg-muted/20 p-2 h-12 animate-pulse" aria-hidden />
              ))}
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
