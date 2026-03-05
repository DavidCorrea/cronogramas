import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roles, scheduleDateAssignments, eventRolePriorities } from "@/db/schema";
import { eq, max } from "drizzle-orm";
import { requireGroupAccess, apiError, parseBody } from "@/lib/api-helpers";
import { roleCreateSchema, roleUpdateSchema, roleReorderSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, groupId))
    .orderBy(roles.displayOrder);
  return NextResponse.json(allRoles);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const raw = await request.json();
  const parsed = parseBody(roleCreateSchema, raw);
  if (parsed.error) return parsed.error;
  const { name, requiredCount = 1, dependsOnRoleId, exclusiveGroupId, isRelevant = false } = parsed.data;

  // Assign displayOrder = max(existing) + 1 so new roles appear at the end
  const [maxRow] = await db
    .select({ maxOrder: max(roles.displayOrder) })
    .from(roles)
    .where(eq(roles.groupId, groupId));
  const nextOrder = (maxRow?.maxOrder ?? -1) + 1;

  const insertValues: Record<string, unknown> = {
    name,
    requiredCount,
    displayOrder: nextOrder,
    groupId,
    isRelevant,
  };
  if (dependsOnRoleId !== undefined) insertValues.dependsOnRoleId = dependsOnRoleId;
  if (exclusiveGroupId !== undefined) insertValues.exclusiveGroupId = exclusiveGroupId;

  const role = (await db
    .insert(roles)
    .values(insertValues as typeof roles.$inferInsert)
    .returning())[0];

  return NextResponse.json(role, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const raw = await request.json();
  const parsed = parseBody(roleUpdateSchema, raw);
  if (parsed.error) return parsed.error;
  const { id, name, requiredCount, dependsOnRoleId, exclusiveGroupId, isRelevant } = parsed.data;

  const existing = (await db.select().from(roles).where(eq(roles.id, id)))[0];
  if (!existing) {
    return apiError("Role not found", 404, "NOT_FOUND");
  }
  if (existing.groupId !== groupId) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  const updates: Partial<{ name: string; requiredCount: number; dependsOnRoleId: number | null; exclusiveGroupId: number | null; isRelevant: boolean }> = {};
  if (name !== undefined) updates.name = name.trim();
  if (requiredCount !== undefined) updates.requiredCount = requiredCount;
  if (dependsOnRoleId !== undefined) updates.dependsOnRoleId = dependsOnRoleId;
  if (exclusiveGroupId !== undefined) updates.exclusiveGroupId = exclusiveGroupId;
  if (typeof isRelevant === "boolean") updates.isRelevant = isRelevant;

  await db.update(roles).set(updates).where(eq(roles.id, id));

  const updated = (await db.select().from(roles).where(eq(roles.id, id)))[0];
  return NextResponse.json(updated);
}

/**
 * PATCH: Batch reorder roles. Accepts an array of { id, displayOrder } pairs.
 */
export async function PATCH(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const raw = await request.json();
  const parsed = parseBody(roleReorderSchema, raw);
  if (parsed.error) return parsed.error;
  const { order } = parsed.data;

  for (const item of order) {
    await db.update(roles)
      .set({ displayOrder: item.displayOrder })
      .where(eq(roles.id, item.id));
  }

  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, groupId))
    .orderBy(roles.displayOrder);
  return NextResponse.json(allRoles);
}

export async function DELETE(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return apiError("Role id is required", 400, "MISSING_ID");
  }

  const roleId = parseInt(id, 10);

  const existing = (await db.select().from(roles).where(eq(roles.id, roleId)))[0];
  if (!existing) {
    return apiError("Role not found", 404, "NOT_FOUND");
  }
  if (existing.groupId !== groupId) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  // Cascade: delete schedule entries referencing this role
  await db.delete(scheduleDateAssignments)
    .where(eq(scheduleDateAssignments.roleId, roleId));

  await db.delete(eventRolePriorities)
    .where(eq(eventRolePriorities.roleId, roleId));

  // Delete the role itself (member_roles cascade via schema)
  await db.delete(roles).where(eq(roles.id, roleId));

  return NextResponse.json({ success: true });
}
