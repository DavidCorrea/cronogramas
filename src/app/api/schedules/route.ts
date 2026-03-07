import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  schedules,
  scheduleDateAssignments,
  scheduleDate,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getScheduleDates } from "@/lib/dates";
import { loadScheduleConfig, getPreviousAssignments } from "@/lib/schedule-helpers";
import { generateGroupSchedule } from "@/lib/schedule-model";
import { requireGroupAccess } from "@/lib/api-helpers";
import { logScheduleAction } from "@/lib/audit-log";
import { revalidateCronograma } from "@/lib/public-schedule";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export async function GET(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const allSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.groupId, groupId))
    .orderBy(schedules.year, schedules.month);

  return NextResponse.json(allSchedules);
}

export async function POST(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const body = await request.json();
  const { months } = body;

  if (!months || !Array.isArray(months) || months.length === 0) {
    return NextResponse.json(
      { error: "months is required (array of { month, year })" },
      { status: 400 }
    );
  }

  const config = await loadScheduleConfig(groupId);

  if (config.activeDayNames.length === 0) {
    return NextResponse.json(
      { error: "No active recurring events configured" },
      { status: 400 }
    );
  }

  let previousAssignments = await getPreviousAssignments(groupId);

  const createdSchedules = [];

  for (const { month, year } of months) {
    const existing = (await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.groupId, groupId), eq(schedules.month, month), eq(schedules.year, year))))[0];
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un cronograma para ${MONTH_NAMES[month - 1]} ${year}.` },
        { status: 409 }
      );
    }

    const dates = getScheduleDates(month, year, config.activeDayNames);
    if (dates.length === 0) continue;

    const result = generateGroupSchedule({
      dates,
      events: config.recurringEvents,
      roles: config.roleDefinitions,
      members: config.memberInfos,
      previousAssignments,
    });

    const schedule = (await db
      .insert(schedules)
      .values({ month, year, status: "draft", groupId })
      .returning())[0];

    // Persist schedule_date rows from model output and build lookup for assignments
    const sdIdByKey = new Map<string, number>();
    for (const sd of result.scheduleDates) {
      const [inserted] = await db
        .insert(scheduleDate)
        .values({
          scheduleId: schedule.id,
          date: sd.date,
          type: sd.type,
          label: sd.label,
          note: null,
          startTimeUtc: sd.startTimeUtc,
          endTimeUtc: sd.endTimeUtc,
          recurringEventId: sd.recurringEventId,
        })
        .returning({ id: scheduleDate.id });
      sdIdByKey.set(`${sd.date}|${sd.recurringEventId}`, inserted.id);
    }

    for (const a of result.assignments) {
      const scheduleDateId = sdIdByKey.get(`${a.date}|${a.recurringEventId}`);
      if (!scheduleDateId) continue;
      await db.insert(scheduleDateAssignments).values({
        scheduleDateId,
        roleId: a.roleId,
        memberId: a.memberId,
      });
    }

    await logScheduleAction(
      schedule.id,
      accessResult.user.id,
      "created",
      `Cronograma generado para ${MONTH_NAMES[month - 1]} ${year}`
    );

    previousAssignments = [...previousAssignments, ...result.assignments];

    createdSchedules.push({
      ...schedule,
      assignments: result.assignments,
      unfilledSlots: result.unfilledSlots,
    });

    await revalidateCronograma(groupId, month, year);
  }

  return NextResponse.json(createdSchedules, { status: 201 });
}
