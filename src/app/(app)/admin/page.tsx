import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateBootstrapToken } from "@/lib/admin-bootstrap-token";
import { loadAdminUsers, loadAdminGroups } from "@/lib/data-access";
import { RootLoadingSkeleton } from "@/components/Skeletons";
import AdminPageClient from "./AdminPageClient";

export default async function AdminPage() {
  const session = await auth();

  const adminUserId = session?.realUserId ?? session?.user?.id;
  let isSessionAdmin = false;

  if (adminUserId) {
    const dbUser = (
      await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, adminUserId))
    )[0];
    if (dbUser?.isAdmin) {
      isSessionAdmin = true;
    }
  }

  if (!isSessionAdmin) {
    const hasAdmins =
      (
        await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.isAdmin, true))
          .limit(1)
      ).length > 0;

    if (hasAdmins) {
      redirect("/admin/login");
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("admin-bootstrap-token")?.value;
    if (!token || !validateBootstrapToken(token)) {
      redirect("/admin/login");
    }
  }

  return (
    <Suspense fallback={<RootLoadingSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const [initialUsers, initialGroups] = await Promise.all([
    loadAdminUsers(),
    loadAdminGroups(),
  ]);

  return (
    <AdminPageClient
      initialUsers={initialUsers}
      initialGroups={initialGroups}
    />
  );
}
