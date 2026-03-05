import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult.error) return adminResult.error;

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      isAdmin: users.isAdmin,
      canCreateGroups: users.canCreateGroups,
      canExportCalendars: users.canExportCalendars,
    })
    .from(users)
    .orderBy(users.name);

  return NextResponse.json(allUsers);
}

export async function PUT(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult.error) return adminResult.error;

  const body = await request.json();
  const { userId, isAdmin, canCreateGroups, canExportCalendars } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json(
      { error: "userId es obligatorio" },
      { status: 400 }
    );
  }

  const existing = (await db
    .select()
    .from(users)
    .where(eq(users.id, userId)))[0];

  if (!existing) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  const updateFields: Record<string, unknown> = {};
  if (typeof isAdmin === "boolean") updateFields.isAdmin = isAdmin;
  if (typeof canCreateGroups === "boolean") updateFields.canCreateGroups = canCreateGroups;
  if (typeof canExportCalendars === "boolean") updateFields.canExportCalendars = canExportCalendars;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json(
      { error: "No hay campos para actualizar" },
      { status: 400 }
    );
  }

  await db.update(users)
    .set(updateFields)
    .where(eq(users.id, userId));

  const updated = (await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      isAdmin: users.isAdmin,
      canCreateGroups: users.canCreateGroups,
      canExportCalendars: users.canExportCalendars,
    })
    .from(users)
    .where(eq(users.id, userId)))[0];

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult.error) return adminResult.error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json(
      { error: "id es obligatorio" },
      { status: 400 }
    );
  }

  const existing = (await db
    .select()
    .from(users)
    .where(eq(users.id, userId)))[0];

  if (!existing) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
