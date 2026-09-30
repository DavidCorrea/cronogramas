import { auth } from "@/lib/auth";
import SessionProvider from "@/components/SessionProvider";
import AppNavBar from "@/components/AppNavBar";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";

/**
 * Layout for the signed-in app. The session is read on the server here (not in
 * the root layout) so the public cronograma under (public) stays cacheable.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <AppNavBar />
      <KeyboardShortcuts />
      {children}
    </SessionProvider>
  );
}
