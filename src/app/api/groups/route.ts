import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groups, groupCollaborators, users, recurringEvents, weekdays, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, hasGroupAccess, apiError, parseBody } from "@/lib/api-helpers";
import { groupCreateSchema } from "@/lib/schemas/groups";
import { loadUserGroups } from "@/lib/data-access";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (slug) {
    const group = (await db
      .select()
      .from(groups)
      .where(eq(groups.slug, slug)))[0];

    if (!group) {
      return apiError("Grupo no encontrado", 404, "GROUP_NOT_FOUND");
    }

    const access = await hasGroupAccess(userId, group.id);
    if (!access) {
      return apiError("Sin permiso", 403, "FORBIDDEN");
    }

    return NextResponse.json(group);
  }

  const result = await loadUserGroups(userId);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  const dbUser = (await db
    .select({ isAdmin: users.isAdmin, canCreateGroups: users.canCreateGroups })
    .from(users)
    .where(eq(users.id, userId)))[0];

  if (!dbUser || (!dbUser.isAdmin && !dbUser.canCreateGroups)) {
    return apiError("No tienes permisos para crear grupos", 403, "FORBIDDEN");
  }

  const body = await request.json();
  const parsed = parseBody(groupCreateSchema, body);
  if (parsed.error) return parsed.error;
  const { name, slug, days, roles: rolesList, collaboratorUserIds } = parsed.data;

  const existing = (await db
    .select()
    .from(groups)
    .where(eq(groups.slug, slug)))[0];

  if (existing) {
    return apiError("Ya existe un grupo con ese slug", 409, "CONFLICT");
  }

  const group = (await db
    .insert(groups)
    .values({ name, slug, ownerId: userId })
    .returning())[0];

  const weekdayRows =
    Array.isArray(days) && days.length > 0
      ? await db.select().from(weekdays).orderBy(weekdays.displayOrder)
      : [];
  const nameToId = new Map(weekdayRows.map((w) => [w.name, w.id]));

  const eventRows = (Array.isArray(days) ? days : []).flatMap((d) => {
    const weekdayId =
      typeof d.weekdayId === "number" ? d.weekdayId : d.dayOfWeek ? nameToId.get(d.dayOfWeek) : undefined;
    if (weekdayId == null) return [];
    return [{
      weekdayId,
      active: d.active ?? true,
      type: d.type ?? "assignable",
      label: d.label && String(d.label).trim() ? String(d.label).trim() : "Evento",
      startTimeUtc: "00:00",
      endTimeUtc: "23:59",
      groupId: group.id,
    }];
  });

  const roleRows = (Array.isArray(rolesList) ? rolesList : []).flatMap((r, i) =>
    r.name && typeof r.name === "string" && r.name.trim()
      ? [{ name: r.name.trim(), requiredCount: 1, displayOrder: i, groupId: group.id }]
      : []
  );

  const collaboratorRows = (Array.isArray(collaboratorUserIds) ? collaboratorUserIds : [])
    .filter((uid) => uid !== userId)
    .map((uid) => ({ userId: uid, groupId: group.id }));

  // A new group's events, roles and collaborators are independent of each
  // other, so this is three inserts rather than one per row.
  await Promise.all([
    eventRows.length > 0 ? db.insert(recurringEvents).values(eventRows) : Promise.resolve(),
    roleRows.length > 0 ? db.insert(roles).values(roleRows) : Promise.resolve(),
    collaboratorRows.length > 0 ? db.insert(groupCollaborators).values(collaboratorRows) : Promise.resolve(),
  ]);

  return NextResponse.json(group, { status: 201 });
}
