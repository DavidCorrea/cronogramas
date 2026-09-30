"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Cronograma segment error boundary. Catches errors under [slug]/cronograma.
 * Reintentar + Volver to cronograma (current month).
 */
export default function CronogramaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations("errorBoundary");
  const tCommon = useTranslations("common");

  useEffect(() => {
    console.error("Cronograma error boundary:", error?.message ?? error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background text-foreground px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("message")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {tCommon("retry")}
          </button>
          <Link
            href={slug ? `/${slug}/cronograma` : "/"}
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:border-foreground transition-colors"
          >
            {tCommon("back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
