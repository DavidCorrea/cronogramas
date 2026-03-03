"use client";

import Link from "next/link";

interface BackLinkProps {
  href: string;
  label: string;
}

/** Consistent "Volver" / back link for form and detail pages. Place at top-left above or beside the page title. */
export default function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
    >
      <span aria-hidden>←</span>
      <span>{label}</span>
    </Link>
  );
}
