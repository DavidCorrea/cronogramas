import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, memberRoles, memberAvailability, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireGroupAccess } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const allMembers = await db
    .select({
      id: members.id,
      name: members.name,
      memberEmail: members.email,
      userId: members.userId,
      groupId: members.groupId,
      userEmail: users.email,
      userImage: users.image,
      userName: users.name,
    })
    .from(members)
    .leftJoin(users, eq(members.userId, users.id))
    .where(eq(members.groupId, groupId))
    .orderBy(members.name);

  const result = await Promise.all(allMembers.map(async (member) => {
    const roles = await db
      .select()
      .from(memberRoles)
      .where(eq(memberRoles.memberId, member.id));

    const availability = await db
      .select({
        weekdayId: memberAvailability.weekdayId,
        startTimeUtc: memberAvailability.startTimeUtc,
        endTimeUtc: memberAvailability.endTimeUtc,
      })
      .from(memberAvailability)
      .where(eq(memberAvailability.memberId, member.id));

    return {
      id: member.id,
      name: member.name,
      memberEmail: member.memberEmail,
      userId: member.userId,
      groupId: member.groupId,
      email: member.userEmail,
      image: member.userImage,
      userName: member.userName,
      roleIds: roles.map((r) => r.roleId),
      availability: availability.map((a) => ({
        weekdayId: a.weekdayId,
        startTimeUtc: a.startTimeUtc ?? "00:00",
        endTimeUtc: a.endTimeUtc ?? "23:59",
      })),
      availableDayIds: [...new Set(availability.map((a) => a.weekdayId))],
    };
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const body = await request.json();
  const { name, email, userId, roleIds = [] } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 }
    );
  }

  let linkedUser = null;
  // Determine the email to store: if linking a user, use their email; otherwise use the provided email
  let memberEmail: string | null = email && typeof email === "string" ? email.trim().toLowerCase() : null;

  if (userId && typeof userId === "string") {
    // Verify user exists
    linkedUser = (await db
      .select()
      .from(users)
      .where(eq(users.id, userId)))[0] ?? null;

    if (!linkedUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }
    // Auto-populate email from the linked user
    if (linkedUser.email) {
      memberEmail = linkedUser.email.toLowerCase().trim();
    }
  }

  // Check for duplicate email within the group
  if (memberEmail) {
    const existing = (await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.groupId, groupId), eq(members.email, memberEmail))))[0];
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un miembro con ese email en este grupo" },
        { status: 409 }
      );
    }
  }

  const member = (await db
    .insert(members)
    .values({ name: name.trim(), email: memberEmail || null, userId: userId || null, groupId })
    .returning())[0];

  // Assign roles
  for (const roleId of roleIds) {
    await db.insert(memberRoles)
      .values({ memberId: member.id, roleId });
  }

  // Assign availability (default all-day 00:00–23:59 UTC when using availableDayIds)
  const availabilityList = Array.isArray(body.availability) && body.availability.length > 0
    ? body.availability
    : (body.availableDayIds ?? []).map((weekdayId: number) => ({
        weekdayId,
        startTimeUtc: "00:00",
        endTimeUtc: "23:59",
      }));

  for (const a of availabilityList) {
    const weekdayId = a.weekdayId != null ? Number(a.weekdayId) : NaN;
    if (!Number.isInteger(weekdayId) || weekdayId < 1) continue;
    const start = typeof a.startTimeUtc === "string" && /^\d{1,2}:\d{2}$/.test(a.startTimeUtc.trim())
      ? a.startTimeUtc.trim()
      : "00:00";
    const end = typeof a.endTimeUtc === "string" && /^\d{1,2}:\d{2}$/.test(a.endTimeUtc.trim())
      ? a.endTimeUtc.trim()
      : "23:59";
    await db.insert(memberAvailability)
      .values({ memberId: member.id, weekdayId, startTimeUtc: start, endTimeUtc: end });
  }

  return NextResponse.json(
    {
      ...member,
      memberEmail: member.email,
      email: linkedUser?.email ?? null,
      image: linkedUser?.image ?? null,
      userName: linkedUser?.name ?? null,
      roleIds,
      availability: availabilityList,
    },
    { status: 201 }
  );
}
