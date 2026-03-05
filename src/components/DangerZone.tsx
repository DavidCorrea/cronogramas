"use client";

import { useTranslations } from "next-intl";

interface DangerZoneProps {
  /** Section title; defaults to common.dangerZone */
  title?: string;
  /** Section description; defaults to common.dangerZoneDescription */
  description?: string;
  children: React.ReactNode;
}

/**
 * Visually distinct block for destructive actions. Place at the bottom of
 * pages where a resource can be deleted. Put the delete (or leave/remove)
 * action inside this section.
 */
export function DangerZone({ title, description, children }: DangerZoneProps) {
  const t = useTranslations("common");
  return (
    <section
      className="mt-12 rounded-lg border border-destructive/30 bg-destructive/5 p-6"
      aria-labelledby="danger-zone-title"
    >
      <h2
        id="danger-zone-title"
        className="text-lg font-medium text-foreground"
      >
        {title ?? t("dangerZone")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ?? t("dangerZoneDescription")}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
