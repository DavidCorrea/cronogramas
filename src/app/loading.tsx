import { SkeletonRegion, SkeletonRow } from "@/components/Skeletons";

/**
 * Route-level loading UI for dashboard (/) and other root segments.
 * Shows skeleton cards and grid to avoid blank screen during navigation.
 */
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SkeletonRegion className="mb-12" aria-label="Cargando…">
          <div className="h-10 w-3/4 max-w-md animate-pulse rounded bg-muted" aria-hidden />
          <div className="mt-3 h-5 w-full max-w-lg animate-pulse rounded bg-muted" aria-hidden />
        </SkeletonRegion>

        <div className="border-t border-border pt-8 lg:grid lg:grid-cols-[1fr_1px_1fr] lg:gap-8">
          <div>
            <div className="mb-12">
              <div className="h-3 w-32 animate-pulse rounded bg-muted mb-6" aria-hidden />
              <div className="h-5 w-48 animate-pulse rounded bg-muted" aria-hidden />
              <div className="mt-3 h-4 w-64 animate-pulse rounded bg-muted" aria-hidden />
              <div className="mt-3 space-y-2">
                <SkeletonRow avatar={false} lines={2} />
                <SkeletonRow avatar={false} lines={2} />
              </div>
            </div>
            <div className="mb-12 border-t border-border pt-8">
              <div className="h-3 w-24 animate-pulse rounded bg-muted mb-6" aria-hidden />
              <div className="grid grid-cols-7 gap-1 mb-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-muted" aria-hidden />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" aria-hidden />
                ))}
              </div>
            </div>
          </div>
          <div className="hidden lg:block bg-border" aria-hidden />
          <div className="border-t border-border pt-8 mt-4 lg:border-t-0 lg:pt-0 lg:mt-0">
            <div className="mb-6 flex items-center justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" aria-hidden />
              <div className="h-8 w-28 animate-pulse rounded bg-muted" aria-hidden />
            </div>
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="py-5 first:pt-0">
                  <SkeletonRow lines={2} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
