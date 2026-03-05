import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groups, groupCollaborators, members, users, recurringEvents, weekdays, roles } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, hasGroupAccess, apiError, parseBody } from "@/lib/api-helpers";
import { groupCreateSchema } from "@/lib/schemas";

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
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    return NextResponse.json(group);
  }

  // Get groups the user owns
  const ownedGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.ownerId, userId));

  // Get groups the user collaborates on
  const collabGroups = await db
    .select({ groupId: groupCollaborators.groupId })
    .from(groupCollaborators)
    .where(eq(groupCollaborators.userId, userId));

  // Get groups the user is a member of
  const memberGroups = await db
    .select({ groupId: members.groupId })
    .from(members)
    .where(eq(members.userId, userId));

  const groupIds = [
    ...new Set([
      ...ownedGroups.map((g) => g.id),
      ...collabGroups.map((g) => g.groupId),
      ...memberGroups.map((g) => g.groupId),
    ]),
  ];

  if (groupIds.length === 0) {
    return NextResponse.json([]);
  }

  const allGroups = await db
    .select()
    .from(groups)
    .where(inArray(groups.id, groupIds))
    .orderBy(groups.name);

  // Annotate each group with the user's role
  const result = allGroups.map((g) => ({
    ...g,
    role: g.ownerId === userId
      ? "owner"
      : collabGroups.some((c) => c.groupId === g.id)
        ? "collaborator"
        : "member",
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  // Check if user has permission to create groups
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

  if (Array.isArray(days) && days.length > 0) {
    const weekdayRows = await db.select().from(weekdays).orderBy(weekdays.displayOrder);
    const nameToId = new Map(weekdayRows.map((w) => [w.name, w.id]));
    for (const d of days) {
      const weekdayId = typeof d.weekdayId === "number" ? d.weekdayId : (d.dayOfWeek ? nameToId.get(d.dayOfWeek) : undefined);
      if (weekdayId != null) {
        await db.insert(recurringEvents).values({
          weekdayId,
          active: d.active ?? true,
          type: d.type ?? "assignable",
          label: (d.label && String(d.label).trim()) ? String(d.label).trim() : "Evento",
          startTimeUtc: "00:00",
          endTimeUtc: "23:59",
          groupId: group.id,
        });
      }
    }
  }

  if (Array.isArray(rolesList) && rolesList.length > 0) {
    for (let i = 0; i < rolesList.length; i++) {
      const r = rolesList[i];
      if (r.name && typeof r.name === "string" && r.name.trim()) {
        await db.insert(roles).values({
          name: r.name.trim(),
          requiredCount: 1,
          displayOrder: i,
          groupId: group.id,
        });
      }
    }
  }

  if (Array.isArray(collaboratorUserIds) && collaboratorUserIds.length > 0) {
    for (const uid of collaboratorUserIds) {
      if (uid !== userId) {
        await db.insert(groupCollaborators).values({
          userId: uid,
          groupId: group.id,
        });
      }
    }
  }

  return NextResponse.json(group, { status: 201 });
}
