"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Root error boundary. Catches runtime and fetch errors in the app tree.
 * Shows a clear message and Reintentar / Volver actions.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary");
  const tCommon = useTranslations("common");

  useEffect(() => {
    console.error("Root error boundary:", error?.message ?? error);
  }, [error]);

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center bg-background text-foreground px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("message")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {tCommon("retry")}
          </button>
          <Link
            href="/"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:border-foreground transition-colors"
          >
            {tCommon("back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
