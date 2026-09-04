import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveGroupWithAccess } from "@/lib/group";

/**
 * Resolve group by slug and verify the current user has config access (owner or collaborator).
 * Use in server components under [slug]/config. Redirects to login if unauthenticated;
 * notFound() if group missing or no access.
 *
 * Wrapped in React.cache() so the layout and page can both call it without duplicate DB queries.
 */
export const getGroupForConfigLayout = cache(async function getGroupForConfigLayout(slug: string): Promise<{
  id: number;
  name: string;
  slug: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolved = await resolveGroupWithAccess(slug, session.user.id);
  if (!resolved || !resolved.hasAccess) {
    notFound();
  }

  return resolved.group;
});
