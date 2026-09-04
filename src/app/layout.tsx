import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { auth } from "@/lib/auth";
import esMessages from "../../messages/es.json";
import SessionProvider from "@/components/SessionProvider";
import QueryProvider from "@/components/QueryProvider";
import AppNavBar from "@/components/AppNavBar";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { WebVitals } from "@/components/WebVitals";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cronogramas",
  description: "Genera cronogramas justos y rotacionales para tu banda",
};

const THEME_KEY = "band-scheduler-theme";

/** Inline script runs before first paint so first-time visitors get prefers-color-scheme without flash. */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var doc = document.documentElement;
    doc.classList.add(dark ? "dark" : "light");
    doc.classList.remove(dark ? "light" : "dark");
    doc.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, session] = await Promise.all([
    getMessages().then((m) => m ?? esMessages),
    auth(),
  ]);
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <SessionProvider session={session}>
              <AppNavBar />
              <KeyboardShortcuts />
              {children}
              <Analytics />
              <SpeedInsights />
              <WebVitals />
            </SessionProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
