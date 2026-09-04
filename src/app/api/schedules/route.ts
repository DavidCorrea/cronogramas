import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  schedules,
  scheduleDateAssignments,
  scheduleDate,
  groups,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getScheduleDates } from "@/lib/dates";
import { loadScheduleConfig, getPreviousAssignments } from "@/lib/schedule-helpers";
import { generateGroupSchedule } from "@/lib/schedule-model";
import { requireGroupAccess, parseBody, apiError } from "@/lib/api-helpers";
import { logScheduleAction } from "@/lib/audit-log";
import { revalidateCronograma } from "@/lib/public-schedule";
import { scheduleCreateSchema } from "@/lib/schemas/schedules";

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
  const parsed = parseBody(scheduleCreateSchema, body);
  if (parsed.error) return parsed.error;
  const { months } = parsed.data;

  // Independent of each other, and the slug is resolved once here rather than
  // per month inside the loop below.
  const [config, initialAssignments, group] = await Promise.all([
    loadScheduleConfig(groupId),
    getPreviousAssignments(groupId),
    db
      .select({ slug: groups.slug })
      .from(groups)
      .where(eq(groups.id, groupId))
      .then((rows) => rows[0]),
  ]);

  if (config.activeDayNames.length === 0) {
    return apiError("No hay eventos recurrentes activos", 400, "VALIDATION");
  }

  const groupSlug = group?.slug;
  let previousAssignments = initialAssignments;

  const createdSchedules = [];

  for (const { month, year } of months) {
    const existing = (await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.groupId, groupId), eq(schedules.month, month), eq(schedules.year, year))))[0];
    if (existing) {
      return apiError(`Ya existe un cronograma para ${MONTH_NAMES[month - 1]} ${year}.`, 409, "DUPLICATE");
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

    const insertedDates = await db
      .insert(scheduleDate)
      .values(
        result.scheduleDates.map((sd) => ({
          scheduleId: schedule.id,
          date: sd.date,
          type: sd.type,
          label: sd.label,
          note: null,
          startTimeUtc: sd.startTimeUtc,
          endTimeUtc: sd.endTimeUtc,
          recurringEventId: sd.recurringEventId,
        }))
      )
      .returning({ id: scheduleDate.id, date: scheduleDate.date, recurringEventId: scheduleDate.recurringEventId });

    const sdIdByKey = new Map<string, number>();
    for (const row of insertedDates) {
      sdIdByKey.set(`${row.date}|${row.recurringEventId}`, row.id);
    }

    const assignmentValues = result.assignments
      .map((a) => {
        const scheduleDateId = sdIdByKey.get(`${a.date}|${a.recurringEventId}`);
        if (!scheduleDateId) return null;
        return { scheduleDateId, roleId: a.roleId, memberId: a.memberId };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (assignmentValues.length > 0) {
      await db.insert(scheduleDateAssignments).values(assignmentValues);
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

    await revalidateCronograma(groupId, month, year, groupSlug);
  }

  return NextResponse.json(createdSchedules, { status: 201 });
}
