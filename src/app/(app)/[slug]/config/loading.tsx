import { ConfigContentSkeleton } from "@/components/Skeletons";

/**
 * Route-level loading UI for [slug]/config/*.
 * Shows sub-nav placeholder and list-style skeleton so layout doesn't jump when data loads.
 */
export default function ConfigLoading() {
  return <ConfigContentSkeleton />;
}
