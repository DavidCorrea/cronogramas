import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveGroupBySlug } from "@/lib/group";
import { hasGroupAccess } from "@/lib/api-helpers";

/**
 * Resolve group by slug and verify the current user has config access (owner or collaborator).
 * Use in server components under [slug]/config. Redirects to login if unauthenticated;
 * notFound() if group missing or no access.
 */
export async function getGroupForConfigLayout(slug: string): Promise<{
  id: number;
  name: string;
  slug: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const group = await resolveGroupBySlug(slug);
  if (!group) {
    notFound();
  }

  const access = await hasGroupAccess(session.user.id, group.id);
  if (!access) {
    notFound();
  }

  return { id: group.id, name: group.name, slug: group.slug };
}
