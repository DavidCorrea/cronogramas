import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadUserHolidays } from "@/lib/data-access";
import { RootLoadingSkeleton } from "@/components/Skeletons";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <Suspense fallback={<RootLoadingSkeleton />}>
      <SettingsContent session={session} />
    </Suspense>
  );
}

async function SettingsContent({
  session,
}: {
  session: { user: { id: string; name?: string | null; email?: string | null; image?: string | null; isAdmin: boolean } };
}) {
  const holidays = await loadUserHolidays(session.user.id);

  return (
    <SettingsClient
      session={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        isAdmin: session.user.isAdmin,
      }}
      initialHolidays={holidays.map((h) => ({
        id: h.id,
        startDate: h.startDate,
        endDate: h.endDate,
        description: h.description,
      }))}
    />
  );
}
