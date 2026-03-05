"use client";

/**
 * Theme is controlled by an inline script in the root layout (first paint) and by
 * this store when the user toggles. First-time visitors get prefers-color-scheme
 * without flash; returning visitors get their stored preference.
 */
const THEME_KEY = "band-scheduler-theme";

function getSnapshot(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) callback();
  };
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onPrefersChange = () => callback();
  window.addEventListener("storage", onStorage);
  mql.addEventListener("change", onPrefersChange);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
    mql.removeEventListener("change", onPrefersChange);
  };
}

function setTheme(dark: boolean): void {
  const html = document.documentElement;
  if (dark) {
    html.classList.add("dark");
    html.classList.remove("light");
    html.style.colorScheme = "dark";
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
    html.style.colorScheme = "light";
  }
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  listeners.forEach((l) => l());
}

/** Client-only "mounted" store: false until after first microtask. Avoids hydration mismatch when theme differs from server. */
let mounted = false;
const mountedListeners = new Set<() => void>();

function getMountedSnapshot(): boolean {
  return mounted;
}

function subscribeMounted(callback: () => void): () => void {
  mountedListeners.add(callback);
  if (!mounted) {
    queueMicrotask(() => {
      mounted = true;
      mountedListeners.forEach((l) => l());
    });
  }
  return () => {
    mountedListeners.delete(callback);
  };
}

export { THEME_KEY, getSnapshot, subscribe, setTheme, getMountedSnapshot, subscribeMounted };
