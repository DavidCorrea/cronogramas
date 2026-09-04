import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringEvents, weekdays, scheduleDate } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dayIndex } from "@/lib/constants";
import { requireGroupAccess, apiError, parseBody } from "@/lib/api-helpers";
import { eventCreateSchema, eventUpdateSchema } from "@/lib/schemas/events";
import { revalidateGroupCronogramas } from "@/lib/public-schedule";

export async function GET(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const allDays = await db
    .select({
      id: recurringEvents.id,
      weekdayId: recurringEvents.weekdayId,
      dayOfWeek: weekdays.name,
      active: recurringEvents.active,
      type: recurringEvents.type,
      label: recurringEvents.label,
      startTimeUtc: recurringEvents.startTimeUtc,
      endTimeUtc: recurringEvents.endTimeUtc,
      groupId: recurringEvents.groupId,
      notes: recurringEvents.notes,
    })
    .from(recurringEvents)
    .innerJoin(weekdays, eq(recurringEvents.weekdayId, weekdays.id))
    .where(eq(recurringEvents.groupId, groupId));
  allDays.sort((a, b) => dayIndex(a.dayOfWeek ?? "") - dayIndex(b.dayOfWeek ?? ""));
  return NextResponse.json(allDays);
}

export async function PUT(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const body = await request.json();
  const parsed = parseBody(eventUpdateSchema, body);
  if (parsed.error) return parsed.error;
  const { id, active, type, label, startTimeUtc, endTimeUtc, notes, dayOfWeek } = parsed.data;

  const existing = (await db
    .select()
    .from(recurringEvents)
    .where(eq(recurringEvents.id, id)))[0];

  if (!existing || existing.groupId !== groupId) {
    return apiError("Evento no encontrado", 404, "NOT_FOUND");
  }

  const updates: Partial<{
    active: boolean;
    weekdayId: number;
    type: string;
    label: string;
    startTimeUtc: string;
    endTimeUtc: string;
    notes: string | null;
  }> = {};
  if (active !== undefined) updates.active = active;
  if (dayOfWeek !== undefined && dayOfWeek !== "") {
    const weekdayRow = (await db.select().from(weekdays).where(eq(weekdays.name, dayOfWeek)))[0];
    if (!weekdayRow) {
      return apiError("Día de la semana inválido", 400, "VALIDATION");
    }
    updates.weekdayId = weekdayRow.id;
  }
  if (type !== undefined) {
    updates.type = type;
    if (type === "for_everyone") updates.active = true;
  }
  if (label !== undefined) updates.label = label;
  if (startTimeUtc !== undefined) updates.startTimeUtc = startTimeUtc;
  if (endTimeUtc !== undefined) updates.endTimeUtc = endTimeUtc;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return apiError("Al menos un campo debe ser proporcionado", 400, "VALIDATION");
  }

  // When deactivating, remove this event's dates from all schedules so they are "hidden"
  const removesScheduleDates = updates.active === false;
  if (removesScheduleDates) {
    await db.delete(scheduleDate).where(eq(scheduleDate.recurringEventId, id));
  }

  await db.update(recurringEvents)
    .set(updates)
    .where(eq(recurringEvents.id, id));

  const updated = (await db
    .select({
      id: recurringEvents.id,
      weekdayId: recurringEvents.weekdayId,
      dayOfWeek: weekdays.name,
      active: recurringEvents.active,
      type: recurringEvents.type,
      label: recurringEvents.label,
      startTimeUtc: recurringEvents.startTimeUtc,
      endTimeUtc: recurringEvents.endTimeUtc,
      groupId: recurringEvents.groupId,
      notes: recurringEvents.notes,
    })
    .from(recurringEvents)
    .innerJoin(weekdays, eq(recurringEvents.weekdayId, weekdays.id))
    .where(eq(recurringEvents.id, id)))[0];

  if (removesScheduleDates) {
    await revalidateGroupCronogramas(groupId);
  }

  return NextResponse.json(updated);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const body = await request.json();
  const parsed = parseBody(eventCreateSchema, body);
  if (parsed.error) return parsed.error;
  const { dayOfWeek, active, type, label, notes, startTimeUtc, endTimeUtc } = parsed.data;

  const weekdayRow = (await db.select().from(weekdays).where(eq(weekdays.name, dayOfWeek)))[0];
  if (!weekdayRow) {
    return apiError("Día de la semana inválido", 400, "VALIDATION");
  }

  const [created] = await db
    .insert(recurringEvents)
    .values({
      weekdayId: weekdayRow.id,
      groupId,
      active: type === "for_everyone" ? true : active,
      type,
      label,
      notes,
      startTimeUtc,
      endTimeUtc,
    })
    .returning();

  const withDay = await db
    .select({
      id: recurringEvents.id,
      weekdayId: recurringEvents.weekdayId,
      dayOfWeek: weekdays.name,
      active: recurringEvents.active,
      type: recurringEvents.type,
      label: recurringEvents.label,
      startTimeUtc: recurringEvents.startTimeUtc,
      endTimeUtc: recurringEvents.endTimeUtc,
      groupId: recurringEvents.groupId,
      notes: recurringEvents.notes,
    })
    .from(recurringEvents)
    .innerJoin(weekdays, eq(recurringEvents.weekdayId, weekdays.id))
    .where(eq(recurringEvents.id, created.id));

  return NextResponse.json(withDay[0], { status: 201 });
}
