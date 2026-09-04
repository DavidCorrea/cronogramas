"use client";

import { useSyncExternalStore } from "react";

/** Tailwind's `lg` breakpoint, the width at which the schedule view switches layouts. */
const DESKTOP_QUERY = "(min-width: 1024px)";

let mediaQuery: MediaQueryList | null = null;

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  mediaQuery ??= window.matchMedia(DESKTOP_QUERY);
  return mediaQuery;
}

function subscribe(callback: () => void): () => void {
  const query = getMediaQuery();
  if (!query) return () => {};
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return getMediaQuery()?.matches ?? false;
}

/**
 * Whether the viewport is at the desktop breakpoint, or `null` on the server
 * and during the first render.
 *
 * Callers should render both layouts while this is `null` (leaving the CSS
 * breakpoint to hide the wrong one, so the first paint is correct at any
 * width) and then render only the matching layout, so a view is not kept
 * mounted and re-rendered where it cannot be seen.
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => null as boolean | null,
  );
}
