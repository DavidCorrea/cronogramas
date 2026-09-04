import { cache } from "react";
import { db } from "./db";
import { groups, groupCollaborators } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Resolve a group by its slug. Returns the group or null if not found.
 *
 * Wrapped in React.cache() so the several places that resolve the same slug
 * during one request (page, layout, access check) share a single query.
 */
export const resolveGroupBySlug = cache(async function resolveGroupBySlug(slug: string) {
  const group = (await db
    .select()
    .from(groups)
    .where(eq(groups.slug, slug)))[0];
  return group ?? null;
});

/**
 * Resolve a group by slug together with the user's access to it, in one query.
 *
 * Every authenticated `[slug]/config` view starts with this pair, so resolving
 * the slug and then checking access separately costs a round trip on the
 * critical path of every config page load.
 */
export const resolveGroupWithAccess = cache(async function resolveGroupWithAccess(
  slug: string,
  userId: string,
) {
  const row = (
    await db
      .select({
        id: groups.id,
        name: groups.name,
        slug: groups.slug,
        ownerId: groups.ownerId,
        collaboratorId: groupCollaborators.id,
      })
      .from(groups)
      .leftJoin(
        groupCollaborators,
        and(
          eq(groupCollaborators.groupId, groups.id),
          eq(groupCollaborators.userId, userId),
        ),
      )
      .where(eq(groups.slug, slug))
      .limit(1)
  )[0];

  if (!row) return null;

  return {
    group: { id: row.id, name: row.name, slug: row.slug },
    hasAccess: row.ownerId === userId || row.collaboratorId != null,
  };
});
