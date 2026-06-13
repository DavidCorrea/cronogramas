import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringEvents, scheduleDate, scheduleDateAssignments, schedules } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireGroupAccess, apiError } from "@/lib/api-helpers";
import { loadScheduleConfig, getPreviousAssignments } from "@/lib/schedule-helpers";
import { generateGroupSchedule, filterRebuildableDates } from "@/lib/schedule-model";
import { logScheduleAction } from "@/lib/audit-log";

/**
 * POST: Re-run the assignment algorithm for all schedules that have assignable
 * schedule_date rows linked to this recurring event. Used after the user changes
 * the event's day or times so assignments respect the new config.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { user, groupId } = accessResult;

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

  const assignableDatesWithSchedule = await db
    .select({ scheduleId: scheduleDate.scheduleId })
    .from(scheduleDate)
    .where(
      and(
        eq(scheduleDate.recurringEventId, recurringEventId),
        eq(scheduleDate.type, "assignable")
      )
    );

  const scheduleIds = [...new Set(assignableDatesWithSchedule.map((r) => r.scheduleId))];
  if (scheduleIds.length === 0) {
    return NextResponse.json({ success: true, schedulesUpdated: 0 });
  }

  const config = await loadScheduleConfig(groupId);
  // Base previous assignments (from committed schedules) are the same for every
  // schedule processed below, so load them once instead of per iteration.
  const committedPreviousAssignments = await getPreviousAssignments(groupId);
  const today = new Date().toISOString().split("T")[0];
  let totalApplied = 0;
  let failedCount = 0;

  for (const scheduleId of scheduleIds) {
    try {
      const schedule = (await db.select().from(schedules).where(eq(schedules.id, scheduleId)))[0];
      if (!schedule) continue;

      const allSdRows = await db
        .select({ date: scheduleDate.date, id: scheduleDate.id, recurringEventId: scheduleDate.recurringEventId })
        .from(scheduleDate)
        .where(and(eq(scheduleDate.scheduleId, scheduleId), eq(scheduleDate.type, "assignable")));

      const futureDates = filterRebuildableDates(
        [...new Set(allSdRows.map((r) => r.date))].sort(),
        today
      );

      if (futureDates.length === 0) continue;

      const currentEntries = await db
        .select({
          id: scheduleDateAssignments.id,
          date: scheduleDate.date,
          roleId: scheduleDateAssignments.roleId,
          memberId: scheduleDateAssignments.memberId,
        })
        .from(scheduleDateAssignments)
        .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
        .where(eq(scheduleDate.scheduleId, scheduleId));

      const pastEntries = currentEntries.filter((e) => e.date < today);
      const futureEntries = currentEntries.filter((e) => e.date >= today);

      const allPrevious = [
        ...committedPreviousAssignments,
        ...pastEntries.map((e) => ({ date: e.date, roleId: e.roleId, memberId: e.memberId })),
      ];

      const result = generateGroupSchedule({
        dates: futureDates,
        events: config.recurringEvents,
        roles: config.roleDefinitions,
        members: config.memberInfos,
        previousAssignments: allPrevious,
      });

      if (futureEntries.length > 0) {
        await db
          .delete(scheduleDateAssignments)
          .where(inArray(scheduleDateAssignments.id, futureEntries.map((e) => e.id)));
      }

      const sdIdByKey = new Map<string, number>();
      for (const r of allSdRows) {
        sdIdByKey.set(`${r.date}|${r.recurringEventId ?? ""}`, r.id);
      }

      if (result.assignments.length > 0) {
        const toInsert: { scheduleDateId: number; roleId: number; memberId: number }[] = [];
        for (const a of result.assignments) {
          const scheduleDateId = sdIdByKey.get(`${a.date}|${a.recurringEventId}`);
          if (scheduleDateId) {
            toInsert.push({ scheduleDateId, roleId: a.roleId, memberId: a.memberId });
          }
        }
        if (toInsert.length > 0) {
          await db.insert(scheduleDateAssignments).values(toInsert);
        }
      }

      await logScheduleAction(scheduleId, user.id, "rebuild", {
        message: `Reconstrucción por cambio de evento recurrente: ${result.assignments.length} asignación(es) regenerada(s)`,
        source: "recurring_event_update",
        applied: result.assignments.length,
      });

      totalApplied += result.assignments.length;
    } catch (error) {
      console.error(`Failed to recalculate schedule ${scheduleId}:`, error);
      failedCount++;
    }
  }

  if (failedCount > 0) {
    return apiError(
      `Error al recalcular ${failedCount} cronograma(s)`,
      500,
      "RECALCULATE_ERROR"
    );
  }

  return NextResponse.json({
    success: true,
    schedulesUpdated: scheduleIds.length,
    assignmentsApplied: totalApplied,
  });
}
