import { SkeletonRegion, SkeletonCard } from "@/components/Skeletons";

/**
 * Route-level loading UI for [slug]/config/*.
 * Shows sub-nav placeholder and list-style skeleton so layout doesn't jump when data loads.
 */
export default function ConfigLoading() {
  return (
    <SkeletonRegion className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-label="Cargando…">
      <div className="space-y-12">
        <div>
          <div className="h-9 w-48 animate-pulse rounded bg-muted" aria-hidden />
          <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded bg-muted" aria-hidden />
        </div>
        <div className="border-t border-border pt-8">
          <div className="h-3 w-24 animate-pulse rounded bg-muted mb-6" aria-hidden />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-dashed border-border p-4 h-20 flex items-center justify-center animate-pulse bg-muted/30" aria-hidden />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} height="h-20" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRegion>
  );
}
