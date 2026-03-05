import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import SessionProvider from "@/components/SessionProvider";
import QueryProvider from "@/components/QueryProvider";
import AppNavBar from "@/components/AppNavBar";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Cronogramas",
  description: "Genera cronogramas justos y rotacionales para tu banda",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = (await import("../../messages/es.json")).default;
  // Messages loaded directly so SSG has them; getMessages() can be undefined (e.g. _not-found).

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <SessionProvider>
              <AppNavBar />
              <KeyboardShortcuts />
              {children}
              <Analytics />
              <SpeedInsights />
            </SessionProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
