import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, memberRoles, memberAvailability, users } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireGroupAccess, parseBody, apiError } from "@/lib/api-helpers";
import { memberCreateSchema } from "@/lib/schemas";

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

  if (allMembers.length === 0) return NextResponse.json([]);

  const memberIds = allMembers.map((m) => m.id);

  const [memberRolesRows, availabilityRows] = await Promise.all([
    db.select().from(memberRoles).where(inArray(memberRoles.memberId, memberIds)),
    db
      .select({
        memberId: memberAvailability.memberId,
        weekdayId: memberAvailability.weekdayId,
        startTimeUtc: memberAvailability.startTimeUtc,
        endTimeUtc: memberAvailability.endTimeUtc,
      })
      .from(memberAvailability)
      .where(inArray(memberAvailability.memberId, memberIds)),
  ]);

  const rolesByMemberId = new Map<number, { roleId: number }[]>();
  for (const r of memberRolesRows) {
    const list = rolesByMemberId.get(r.memberId) ?? [];
    list.push({ roleId: r.roleId });
    rolesByMemberId.set(r.memberId, list);
  }

  const availabilityByMemberId = new Map<
    number,
    { weekdayId: number; startTimeUtc: string | null; endTimeUtc: string | null }[]
  >();
  for (const a of availabilityRows) {
    const list = availabilityByMemberId.get(a.memberId) ?? [];
    list.push({
      weekdayId: a.weekdayId,
      startTimeUtc: a.startTimeUtc,
      endTimeUtc: a.endTimeUtc,
    });
    availabilityByMemberId.set(a.memberId, list);
  }

  const result = allMembers.map((member) => {
    const rolesList = rolesByMemberId.get(member.id) ?? [];
    const availability = availabilityByMemberId.get(member.id) ?? [];
    return {
      id: member.id,
      name: member.name,
      memberEmail: member.memberEmail,
      userId: member.userId,
      groupId: member.groupId,
      email: member.userEmail,
      image: member.userImage,
      userName: member.userName,
      roleIds: rolesList.map((r) => r.roleId),
      availability: availability.map((a) => ({
        weekdayId: a.weekdayId,
        startTimeUtc: a.startTimeUtc ?? "00:00",
        endTimeUtc: a.endTimeUtc ?? "23:59",
      })),
      availableDayIds: [...new Set(availability.map((a) => a.weekdayId))],
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const body = await request.json();
  const parsed = parseBody(memberCreateSchema, body);
  if (parsed.error) return parsed.error;
  const { name, email, userId, roleIds = [], availability, availableDayIds } = parsed.data;

  let linkedUser = null;
  let memberEmail: string | null = email ? email.trim().toLowerCase() : null;

  if (userId) {
    linkedUser = (await db
      .select()
      .from(users)
      .where(eq(users.id, userId)))[0] ?? null;

    if (!linkedUser) {
      return apiError("Usuario no encontrado", 404, "NOT_FOUND");
    }
    if (linkedUser.email) {
      memberEmail = linkedUser.email.toLowerCase().trim();
    }
  }

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
    .values({ name, email: memberEmail || null, userId: userId || null, groupId })
    .returning())[0];

  for (const roleId of roleIds) {
    await db.insert(memberRoles)
      .values({ memberId: member.id, roleId });
  }

  const availabilityList = availability && availability.length > 0
    ? availability
    : (availableDayIds ?? []).map((weekdayId) => ({
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
