import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringEvents, scheduleDate } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireGroupAccess, apiError } from "@/lib/api-helpers";
import { revalidateGroupCronogramas } from "@/lib/public-schedule";

/**
 * DELETE: Remove a recurring event.
 * Body: { removeScheduleDates?: boolean }
 * - If removeScheduleDates is true, deletes all schedule_date rows that reference
 *   this event (and their assignments via cascade), then deletes the event.
 * - If false or omitted, only deletes the event (schedule_date.recurring_event_id becomes null).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const { id } = await params;
  const recurringEventId = parseInt(id, 10);
  if (isNaN(recurringEventId)) {
    return apiError("ID de evento inválido", 400, "VALIDATION");
  }

  const event = (await db
    .select({ id: recurringEvents.id, groupId: recurringEvents.groupId })
    .from(recurringEvents)
    .where(eq(recurringEvents.id, recurringEventId)))[0];

  if (!event || event.groupId !== groupId) {
    return apiError("Evento no encontrado", 404, "NOT_FOUND");
  }

  let body: { removeScheduleDates?: boolean } = {};
  try {
    body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : {};
  } catch {
    // no body
  }

  const removeScheduleDates = body.removeScheduleDates === true;

  if (removeScheduleDates) {
    await db
      .delete(scheduleDate)
      .where(eq(scheduleDate.recurringEventId, recurringEventId));
  }

  await db
    .delete(recurringEvents)
    .where(
      and(
        eq(recurringEvents.id, recurringEventId),
        eq(recurringEvents.groupId, groupId)
      )
    );

  if (removeScheduleDates) {
    await revalidateGroupCronogramas(groupId);
  }

  return NextResponse.json({ success: true });
}
