"use client";

import { NextIntlClientProvider } from "next-intl";
import { IntlErrorCode } from "next-intl";

type Props = { children: React.ReactNode };

/**
 * Client-side wrapper that adds onError and getMessageFallback to next-intl.
 * Renders inside a parent NextIntlClientProvider so it inherits messages/locale.
 * Not used in root layout: nesting breaks SSG of /_not-found. Use in route layouts if needed.
 */
export default function IntlErrorHandlingProvider({ children }: Props) {
  return (
    <NextIntlClientProvider
      onError={(error) => {
        if (error.code === IntlErrorCode.MISSING_MESSAGE) {
          console.error("[next-intl]", error.message);
        } else {
          console.error("[next-intl]", error);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        const path = [namespace, key].filter((part) => part != null).join(".");
        return path || "…";
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
