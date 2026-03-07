import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduleDate, schedules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, hasGroupAccess, apiError, parseBody } from "@/lib/api-helpers";
import { logScheduleAction } from "@/lib/audit-log";
import { scheduleNoteSchema } from "@/lib/schemas";
import { revalidateCronograma } from "@/lib/public-schedule";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);

  const schedule = (await db.select({ groupId: schedules.groupId }).from(schedules).where(eq(schedules.id, scheduleId)))[0];
  if (!schedule) {
    return apiError("Cronograma no encontrado", 404, "NOT_FOUND");
  }
  const access = await hasGroupAccess(authResult.user.id, schedule.groupId);
  if (!access) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  const rows = await db
    .select({ date: scheduleDate.date, note: scheduleDate.note })
    .from(scheduleDate)
    .where(eq(scheduleDate.scheduleId, scheduleId));

  const notes = rows
    .filter((r) => r.note != null && r.note.trim() !== "")
    .map((r) => ({ date: r.date, description: r.note! }));

  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);
  const schedule = (await db.select({ groupId: schedules.groupId, month: schedules.month, year: schedules.year }).from(schedules).where(eq(schedules.id, scheduleId)))[0];
  if (!schedule) {
    return apiError("Cronograma no encontrado", 404, "NOT_FOUND");
  }
  const access = await hasGroupAccess(authResult.user.id, schedule.groupId);
  if (!access) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }
  const raw = await request.json();
  const parsed = parseBody(scheduleNoteSchema, raw);
  if (parsed.error) return parsed.error;
  const { date, description } = parsed.data;

  const existing = (await db
    .select()
    .from(scheduleDate)
    .where(
      and(
        eq(scheduleDate.scheduleId, scheduleId),
        eq(scheduleDate.date, date)
      )
    ))[0];

  if (!existing) {
    return apiError("La fecha no existe en el cronograma", 404, "NOT_FOUND");
  }

  await db
    .update(scheduleDate)
    .set({ note: description })
    .where(eq(scheduleDate.id, existing.id));

  await logScheduleAction(scheduleId, authResult.user.id, "note_saved", `Nota guardada para ${date}`);
  await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
  return NextResponse.json({ date: existing.date, description });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);
  const schedule = (await db.select({ groupId: schedules.groupId, month: schedules.month, year: schedules.year }).from(schedules).where(eq(schedules.id, scheduleId)))[0];
  if (!schedule) {
    return apiError("Cronograma no encontrado", 404, "NOT_FOUND");
  }
  const access = await hasGroupAccess(authResult.user.id, schedule.groupId);
  if (!access) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "date query param is required" },
      { status: 400 }
    );
  }

  const existing = (await db
    .select()
    .from(scheduleDate)
    .where(
      and(
        eq(scheduleDate.scheduleId, scheduleId),
        eq(scheduleDate.date, date)
      )
    ))[0];

  if (!existing) {
    return NextResponse.json(
      { error: "Fecha no encontrada" },
      { status: 404 }
    );
  }

  await db
    .update(scheduleDate)
    .set({ note: null })
    .where(eq(scheduleDate.id, existing.id));

  await logScheduleAction(scheduleId, authResult.user.id, "note_deleted", `Nota eliminada para ${date}`);
  await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
  return NextResponse.json({ success: true });
}
