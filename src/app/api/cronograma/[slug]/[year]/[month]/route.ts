import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { apiError } from "@/lib/api-helpers";
import { checkCronogramaRateLimit } from "@/lib/rate-limit";
import { resolveGroupBySlug } from "@/lib/group";
import { buildPublicScheduleResponse } from "@/lib/public-schedule";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; year: string; month: string }> }
) {
  if (!checkCronogramaRateLimit(request)) {
    return apiError("Demasiadas solicitudes. Intenta de nuevo en un minuto.", 429, "RATE_LIMITED");
  }
  const { slug, year: yearStr, month: monthStr } = await params;

  const group = await resolveGroupBySlug(slug);
  if (!group) {
    return apiError("Grupo no encontrado", 404, "GROUP_NOT_FOUND");
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return apiError("Parámetros inválidos", 400, "VALIDATION");
  }

  const schedule = (await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.groupId, group.id),
        eq(schedules.month, month),
        eq(schedules.year, year),
        eq(schedules.status, "committed")
      )
    ))[0];

  if (!schedule) {
    return NextResponse.json(
      { error: "Agenda no encontrada" },
      { status: 404 }
    );
  }

  const data = await buildPublicScheduleResponse({
    id: schedule.id,
    month,
    year,
    groupId: group.id,
    groupName: group.name,
    calendarExportEnabled: group.calendarExportEnabled,
  });

  return NextResponse.json(data);
}
