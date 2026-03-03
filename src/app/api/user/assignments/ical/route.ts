import { NextResponse } from "next/server";
import ical from "ical-generator";
import { db } from "@/lib/db";
import {
  members,
  scheduleDateAssignments,
  scheduleDate,
  schedules,
  roles,
  groups,
} from "@/db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";

/** Same assignment shape as dashboard; fetched from current month onward. */
async function getAssignments(userId: string): Promise<
  Array<{ date: string; roleName: string; groupName: string; groupSlug: string; groupId: number }>
> {
  const userMembers = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId));

  if (userMembers.length === 0) return [];

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const allAssignments: Array<{
    date: string;
    roleName: string;
    groupName: string;
    groupSlug: string;
    groupId: number;
  }> = [];

  for (const membership of userMembers) {
    const group = (await db
      .select()
      .from(groups)
      .where(eq(groups.id, membership.groupId)))[0];
    if (!group) continue;

    const committedSchedules = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.groupId, membership.groupId), eq(schedules.status, "committed")));

    for (const schedule of committedSchedules) {
      const scheduleDatesInRange = await db
        .select({ id: scheduleDate.id, date: scheduleDate.date })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, schedule.id),
            gte(scheduleDate.date, firstOfMonth)
          )
        );

      const scheduleDateIds = scheduleDatesInRange.map((sd) => sd.id);
      const dateByScheduleDateId = new Map(
        scheduleDatesInRange.map((sd) => [sd.id, sd.date])
      );
      if (scheduleDateIds.length === 0) continue;

      const entries = await db
        .select()
        .from(scheduleDateAssignments)
        .where(
          and(
            inArray(scheduleDateAssignments.scheduleDateId, scheduleDateIds),
            eq(scheduleDateAssignments.memberId, membership.id)
          )
        );

      for (const entry of entries) {
        const date = dateByScheduleDateId.get(entry.scheduleDateId);
        if (!date) continue;
        const role = (await db
          .select()
          .from(roles)
          .where(eq(roles.id, entry.roleId)))[0];
        allAssignments.push({
          date,
          roleName: role?.name ?? "Desconocido",
          groupName: group.name,
          groupSlug: group.slug,
          groupId: group.id,
        });
      }
    }
  }

  allAssignments.sort((a, b) => a.date.localeCompare(b.date));
  return allAssignments;
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  const assignments = await getAssignments(userId);

  const calendar = ical({
    name: "Cronogramas – Mis asignaciones",
    description: "Asignaciones generadas desde Cronogramas",
  });

  for (const a of assignments) {
    const [y, m, d] = a.date.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    calendar.createEvent({
      start,
      end,
      allDay: true,
      summary: `${a.roleName} – ${a.groupName}`,
      description: `Asignación: ${a.roleName} en ${a.groupName}.`,
    });
  }

  const ics = calendar.toString();

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mis-asignaciones.ics"',
    },
  });
}
