import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  schedules,
  scheduleDateAssignments,
  scheduleDate,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateSchedule } from "@/lib/scheduler";
import { getScheduleDates, getDayNameFromDateString } from "@/lib/dates";
import { loadScheduleConfig, getPreviousAssignments } from "@/lib/schedule-helpers";
import { requireGroupAccess } from "@/lib/api-helpers";
import { logScheduleAction } from "@/lib/audit-log";

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
  const { months } = body; // Array of { month, year }

  if (!months || !Array.isArray(months) || months.length === 0) {
    return NextResponse.json(
      { error: "months is required (array of { month, year })" },
      { status: 400 }
    );
  }

  const config = await loadScheduleConfig(groupId);
  const { activeDayNames, recurringTypeByDay, roleDefinitions, memberInfos, dayRolePriorityMap } = config;

  if (activeDayNames.length === 0) {
    return NextResponse.json(
      { error: "No active recurring events configured" },
      { status: 400 }
    );
  }

  let previousAssignments = await getPreviousAssignments(groupId);

  const createdSchedules = [];

  for (const { month, year } of months) {
    // Enforce one schedule per month/year per group
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

    const dates = getScheduleDates(month, year, activeDayNames);
    if (dates.length === 0) continue;

    // Split dates into assignable (run scheduler) vs for_everyone (label only)
    const assignableDates = dates.filter((d) => recurringTypeByDay[getDayNameFromDateString(d)]?.type === "assignable");

    const result = generateSchedule({
      dates: assignableDates,
      roles: roleDefinitions,
      members: memberInfos,
      previousAssignments,
      dayRolePriorities:
        Object.keys(dayRolePriorityMap).length > 0 ? dayRolePriorityMap : undefined,
      dayEventTimeWindow:
        Object.keys(config.dayEventTimeWindow).length > 0
          ? config.dayEventTimeWindow
          : undefined,
    });

    const schedule = (await db
      .insert(schedules)
      .values({ month, year, status: "draft", groupId })
      .returning())[0];

    const dateIds = new Map<string, number>();
    for (const date of dates) {
      const dayName = getDayNameFromDateString(date);
      const info = recurringTypeByDay[dayName] ?? { type: "assignable", label: "Evento", recurringEventId: undefined, startTimeUtc: "00:00", endTimeUtc: "23:59" };
      const type = String(info.type).toLowerCase() === "for_everyone" ? "for_everyone" : "assignable";
      const label = info.label ?? null;
      const [inserted] = await db
        .insert(scheduleDate)
        .values({
          scheduleId: schedule.id,
          date,
          type,
          label,
          note: null,
          startTimeUtc: info.startTimeUtc ?? "00:00",
          endTimeUtc: info.endTimeUtc ?? "23:59",
          recurringEventId: info.recurringEventId ?? null,
        })
        .returning({ id: scheduleDate.id });
      dateIds.set(date, inserted.id);
    }

    for (const assignment of result.assignments) {
      const scheduleDateId = dateIds.get(assignment.date);
      if (!scheduleDateId) continue;
      await db.insert(scheduleDateAssignments).values({
        scheduleDateId,
        roleId: assignment.roleId,
        memberId: assignment.memberId,
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
  }

  return NextResponse.json(createdSchedules, { status: 201 });
}
