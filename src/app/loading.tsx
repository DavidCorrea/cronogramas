import { RootLoadingSkeleton } from "@/components/Skeletons";

/**
 * Route-level loading UI for dashboard (/) and other root segments.
 * Shows skeleton cards and grid to avoid blank screen during navigation.
 */
export default function RootLoading() {
  return <RootLoadingSkeleton />;
}
