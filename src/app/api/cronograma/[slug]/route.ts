import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules, scheduleDate } from "@/db/schema";
import { eq, and, desc, asc, or, gt, gte } from "drizzle-orm";
import { apiError } from "@/lib/api-helpers";
import { checkCronogramaRateLimit } from "@/lib/rate-limit";
import { resolveGroupBySlug } from "@/lib/group";
import { buildPublicScheduleResponse } from "@/lib/public-schedule";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!checkCronogramaRateLimit(request)) {
    return apiError("Demasiadas solicitudes. Intenta de nuevo en un minuto.", 429, "RATE_LIMITED");
  }
  const { slug } = await params;

  const group = await resolveGroupBySlug(slug);
  if (!group) {
    return apiError("Grupo no encontrado", 404, "GROUP_NOT_FOUND");
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  let schedule = (await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.groupId, group.id),
        eq(schedules.month, currentMonth),
        eq(schedules.year, currentYear),
        eq(schedules.status, "committed")
      )
    ))[0];

  if (!schedule) {
    const closest = (await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, group.id),
          eq(schedules.status, "committed")
        )
      )
      .orderBy(desc(schedules.year), desc(schedules.month))
      .limit(1))[0];
    schedule = closest ?? null;
  }

  if (schedule) {
    const hasFutureDate = (await db
      .select({ date: scheduleDate.date })
      .from(scheduleDate)
      .where(
        and(
          eq(scheduleDate.scheduleId, schedule.id),
          gte(scheduleDate.date, todayStr)
        )
      )
      .limit(1)).length > 0;

    if (!hasFutureDate) {
      const nextSchedule = (await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.groupId, group.id),
            eq(schedules.status, "committed"),
            or(
              gt(schedules.year, currentYear),
              and(eq(schedules.year, currentYear), gt(schedules.month, currentMonth))
            )
          )
        )
        .orderBy(asc(schedules.year), asc(schedules.month))
        .limit(1))[0];
      if (nextSchedule) schedule = nextSchedule;
    }
  }

  if (!schedule) {
    return NextResponse.json(
      { error: "No hay agenda creada para este mes." },
      { status: 404 }
    );
  }

  const data = await buildPublicScheduleResponse({
    id: schedule.id,
    month: schedule.month,
    year: schedule.year,
    groupId: group.id,
    groupName: group.name,
    calendarExportEnabled: group.calendarExportEnabled,
  });

  return NextResponse.json(data);
}
