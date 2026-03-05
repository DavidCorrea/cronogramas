# Skeletons — Loading placeholders

Shared skeleton components for loading states. Use instead of a full-page spinner when the final layout is predictable (lists, grids, dashboard).

- **SkeletonText**, **SkeletonRow**, **SkeletonCard**, **SkeletonGrid**: primitives built with Tailwind `animate-pulse` and `bg-muted` (theme-aware).
- **SkeletonRegion**: wraps a skeleton area with `aria-busy="true"` and `aria-label` (e.g. "Cargando…") for screen readers.

Import from `@/components/Skeletons`. Used by route-level `loading.tsx` and by pages that show inline skeletons (e.g. when `isLoading` from TanStack Query).
