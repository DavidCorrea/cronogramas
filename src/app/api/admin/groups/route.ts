import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groups, members, recurringEvents, schedules } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult.error) return adminResult.error;

  const allGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      ownerId: groups.ownerId,
      calendarExportEnabled: groups.calendarExportEnabled,
    })
    .from(groups)
    .orderBy(groups.name);

  const [memberCounts, scheduleCounts, eventCounts] = await Promise.all([
    db
      .select({ groupId: members.groupId, count: count() })
      .from(members)
      .groupBy(members.groupId),
    db
      .select({ groupId: schedules.groupId, count: count() })
      .from(schedules)
      .groupBy(schedules.groupId),
    db
      .select({ groupId: recurringEvents.groupId, count: count() })
      .from(recurringEvents)
      .groupBy(recurringEvents.groupId),
  ]);

  const byGroup = (rows: { groupId: number; count: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.groupId, Number(r.count)]));

  const membersByGroup = byGroup(memberCounts);
  const schedulesByGroup = byGroup(scheduleCounts);
  const eventsByGroup = byGroup(eventCounts);

  const result = allGroups.map((g) => ({
    ...g,
    membersCount: membersByGroup[g.id] ?? 0,
    schedulesCount: schedulesByGroup[g.id] ?? 0,
    eventsCount: eventsByGroup[g.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult.error) return adminResult.error;

  const body = await request.json();
  const { groupId, calendarExportEnabled } = body;

  if (!groupId || typeof groupId !== "number") {
    return NextResponse.json(
      { error: "groupId es obligatorio y debe ser un número" },
      { status: 400 }
    );
  }

  const existing = (await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId)))[0];

  if (!existing) {
    return NextResponse.json(
      { error: "Grupo no encontrado" },
      { status: 404 }
    );
  }

  if (typeof calendarExportEnabled !== "boolean") {
    return NextResponse.json(
      { error: "calendarExportEnabled debe ser true o false" },
      { status: 400 }
    );
  }

  await db
    .update(groups)
    .set({ calendarExportEnabled })
    .where(eq(groups.id, groupId));

  const updated = (await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      ownerId: groups.ownerId,
      calendarExportEnabled: groups.calendarExportEnabled,
    })
    .from(groups)
    .where(eq(groups.id, groupId)))[0];

  return NextResponse.json(updated);
}
