"use client";

import { useTranslations } from "next-intl";

/**
 * Centered loading screen with a braille-inspired dot animation.
 * Braille uses a 2×4 dot cell; we render a small grid of dots that cycle opacity
 * in sequence, inspired by https://github.com/6/braille-pattern-cli-loading-indicator
 */
export default function LoadingScreen({
  message,
  fullPage = true,
  compact = false,
}: {
  message?: string;
  fullPage?: boolean;
  /** Inline variant for nav bars: no min-height, smaller dots, single line */
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const displayMessage = message ?? t("loading");
  const cols = 2;
  const rows = 4;
  const dots = cols * rows;
  const dotSize = compact ? 4 : 6;
  const gap = compact ? 3 : 6;

  return (
    <div
      className={
        compact
          ? "min-h-0 flex flex-row items-center justify-center gap-2 py-0"
          : fullPage
            ? "min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center bg-background text-foreground"
            : "min-h-[14rem] flex flex-col items-center justify-center py-12"
      }
      role="status"
      aria-live="polite"
      aria-label={displayMessage}
    >
      <div className="flex flex-col items-center">
        {/* Braille-style dot grid: 2×4 cells, dots animate with staggered delay */}
        <div
          className="flex gap-1"
          style={{ gap: `${gap}px` }}
          aria-hidden
        >
          {Array.from({ length: 2 }).map((_, cellIndex) => (
            <div
              key={cellIndex}
              className="grid grid-cols-2 gap-0.5"
              style={{
                width: cols * dotSize + (cols - 1) * 2,
                height: rows * dotSize + (rows - 1) * 2,
                gap: 2,
              }}
            >
              {Array.from({ length: dots }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full bg-muted-foreground/70 loading-braille-dot"
                  style={{
                    width: dotSize,
                    height: dotSize,
                    animationDelay: `${(cellIndex * dots + i) * 0.08}s`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        {displayMessage && (
          <p className={compact ? "text-sm text-muted-foreground" : "mt-4 text-sm text-muted-foreground"}>
            {displayMessage}
          </p>
        )}
      </div>
    </div>
  );
}
