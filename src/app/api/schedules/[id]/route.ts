import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  schedules,
  scheduleDateAssignments,
  scheduleDate,
  scheduleAuditLog,
  members,
  roles,
  users,
  recurringEvents,
} from "@/db/schema";
import { eq, and, or, lt, gt, asc, desc, inArray } from "drizzle-orm";
import { requireAuth, hasGroupAccess, apiError } from "@/lib/api-helpers";
import { getHolidayConflicts } from "@/lib/holiday-conflicts";
import { loadScheduleConfig, getPreviousAssignments } from "@/lib/schedule-helpers";
import {
  generateGroupSchedule,
  validateDependentRoleAssignment,
  computeDatesWithGaps,
  getDependentRoleIds,
  isDependentRole,
  filterRebuildableDates,
  validateDateInScheduleMonth,
} from "@/lib/schedule-model";
import { logScheduleAction } from "@/lib/audit-log";
import { revalidateCronograma } from "@/lib/public-schedule";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);

  const schedule = (await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId)))[0];

  if (!schedule) {
    return apiError("Cronograma no encontrado", 404, "NOT_FOUND");
  }

  const access = await hasGroupAccess(authResult.user.id, schedule.groupId);
  if (!access) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  const allMembers = await db
    .select({
      id: members.id,
      name: members.name,
      groupId: members.groupId,
    })
    .from(members)
    .where(eq(members.groupId, schedule.groupId));

  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, schedule.groupId));

  const entriesWithDate = await db
    .select({
      id: scheduleDateAssignments.id,
      scheduleDateId: scheduleDateAssignments.scheduleDateId,
      date: scheduleDate.date,
      roleId: scheduleDateAssignments.roleId,
      memberId: scheduleDateAssignments.memberId,
    })
    .from(scheduleDateAssignments)
    .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
    .where(eq(scheduleDate.scheduleId, scheduleId));

  const enrichedEntries = entriesWithDate.map((entry) => ({
    id: entry.id,
    scheduleDateId: entry.scheduleDateId,
    date: entry.date,
    roleId: entry.roleId,
    memberId: entry.memberId,
    memberName:
      allMembers.find((m) => m.id === entry.memberId)?.name ?? "Desconocido",
    roleName: allRoles.find((r) => r.id === entry.roleId)?.name ?? "Desconocido",
  }));

  const scheduleDates = await db
    .select({
      id: scheduleDate.id,
      date: scheduleDate.date,
      type: scheduleDate.type,
      label: scheduleDate.label,
      note: scheduleDate.note,
      startTimeUtc: scheduleDate.startTimeUtc,
      endTimeUtc: scheduleDate.endTimeUtc,
      recurringEventId: scheduleDate.recurringEventId,
      recurringEventLabel: recurringEvents.label,
    })
    .from(scheduleDate)
    .leftJoin(recurringEvents, eq(scheduleDate.recurringEventId, recurringEvents.id))
    .where(eq(scheduleDate.scheduleId, scheduleId))
    .orderBy(asc(scheduleDate.date), asc(scheduleDate.startTimeUtc));

  // Find previous and next schedules
  const { month, year, groupId } = schedule;

  const prevSchedule = (await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.groupId, groupId),
        or(
          lt(schedules.year, year),
          and(eq(schedules.year, year), lt(schedules.month, month))
        )
      )
    )
    .orderBy(desc(schedules.year), desc(schedules.month))
    .limit(1))[0] ?? null;

  const nextSchedule = (await db
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.groupId, groupId),
        or(
          gt(schedules.year, year),
          and(eq(schedules.year, year), gt(schedules.month, month))
        )
      )
    )
    .orderBy(asc(schedules.year), asc(schedules.month))
    .limit(1))[0] ?? null;

  const holidayConflicts = await getHolidayConflicts(
    enrichedEntries.map((e) => ({ date: e.date, memberId: e.memberId })),
    groupId
  );

  const auditLogRows = await db
    .select({
      id: scheduleAuditLog.id,
      action: scheduleAuditLog.action,
      detail: scheduleAuditLog.detail,
      createdAt: scheduleAuditLog.createdAt,
      userName: users.name,
    })
    .from(scheduleAuditLog)
    .leftJoin(users, eq(scheduleAuditLog.userId, users.id))
    .where(eq(scheduleAuditLog.scheduleId, scheduleId))
    .orderBy(desc(scheduleAuditLog.createdAt));

  return NextResponse.json({
    ...schedule,
    scheduleDates: scheduleDates.map((sd) => ({
      id: sd.id,
      date: sd.date,
      type: String(sd.type).toLowerCase() === "for_everyone" ? "for_everyone" : "assignable",
      label: sd.label,
      note: sd.note,
      startTimeUtc: sd.startTimeUtc ?? "00:00",
      endTimeUtc: sd.endTimeUtc ?? "23:59",
      recurringEventId: sd.recurringEventId ?? null,
      recurringEventLabel: sd.recurringEventLabel ?? null,
      entries: enrichedEntries.filter((e) => e.scheduleDateId === sd.id),
    })),
    entries: enrichedEntries,
    roles: allRoles,
    prevScheduleId: prevSchedule?.id ?? null,
    nextScheduleId: nextSchedule?.id ?? null,
    holidayConflicts,
    auditLog: auditLogRows,
  });
}

/**
 * PUT: Update a schedule entry (manual swap) or commit the schedule.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);
  const body = await request.json();

  const schedule = (await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId)))[0];

  if (!schedule) {
    return apiError("Cronograma no encontrado", 404, "NOT_FOUND");
  }

  const putAccess = await hasGroupAccess(authResult.user.id, schedule.groupId);
  if (!putAccess) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  // Commit action
  if (body.action === "commit") {
    await db.update(schedules)
      .set({ status: "committed" })
      .where(eq(schedules.id, scheduleId));

    await logScheduleAction(scheduleId, authResult.user.id, "published", "Cronograma publicado");
    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);

    return NextResponse.json({
      ...schedule,
      status: "committed",
    });
  }

  // Swap entry
  if (body.action === "swap" && body.entryId && body.newMemberId) {
    const entry = (await db
      .select()
      .from(scheduleDateAssignments)
      .where(eq(scheduleDateAssignments.id, body.entryId)))[0];

    if (!entry) {
      return NextResponse.json(
        { error: "Entrada no encontrada" },
        { status: 404 }
      );
    }

    await db.update(scheduleDateAssignments)
      .set({ memberId: body.newMemberId })
      .where(eq(scheduleDateAssignments.id, body.entryId));

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Remove an entry (empty the slot)
  if (body.action === "remove" && body.entryId) {
    const entry = (await db
      .select()
      .from(scheduleDateAssignments)
      .where(eq(scheduleDateAssignments.id, body.entryId)))[0];

    if (!entry) {
      return NextResponse.json(
        { error: "Entrada no encontrada" },
        { status: 404 }
      );
    }

    await db.delete(scheduleDateAssignments)
      .where(eq(scheduleDateAssignments.id, body.entryId));

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Assign a member to a dependent role on a specific schedule date (event)
  if (body.action === "assign" && body.roleId && body.memberId) {
    let sd: { id: number } | undefined;
    if (body.scheduleDateId != null) {
      const row = (await db
        .select({ id: scheduleDate.id })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.id, body.scheduleDateId),
            eq(scheduleDate.scheduleId, scheduleId)
          )
        ))[0];
      sd = row;
    } else if (body.date) {
      sd = (await db
        .select({ id: scheduleDate.id })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, scheduleId),
            eq(scheduleDate.date, body.date)
          )
        )
        .orderBy(asc(scheduleDate.startTimeUtc)))[0];
    }

    if (!sd) {
      return NextResponse.json(
        { error: "Fecha no encontrada en el cronograma" },
        { status: 404 }
      );
    }

    const allRoles = await db
      .select({ id: roles.id, dependsOnRoleId: roles.dependsOnRoleId })
      .from(roles)
      .where(eq(roles.groupId, schedule.groupId));

    const existingAssignments = await db
      .select({ roleId: scheduleDateAssignments.roleId, memberId: scheduleDateAssignments.memberId })
      .from(scheduleDateAssignments)
      .where(eq(scheduleDateAssignments.scheduleDateId, sd.id));

    const validation = validateDependentRoleAssignment({
      roleId: body.roleId,
      memberId: body.memberId,
      roles: allRoles,
      assignmentsOnDate: existingAssignments,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    await db.delete(scheduleDateAssignments).where(
      and(
        eq(scheduleDateAssignments.scheduleDateId, sd.id),
        eq(scheduleDateAssignments.roleId, body.roleId)
      )
    );

    await db.insert(scheduleDateAssignments).values({
      scheduleDateId: sd.id,
      roleId: body.roleId,
      memberId: body.memberId,
    });

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Unassign a dependent role entry
  if (body.action === "unassign" && body.entryId) {
    const entry = (await db
      .select()
      .from(scheduleDateAssignments)
      .where(eq(scheduleDateAssignments.id, body.entryId)))[0];

    if (!entry) {
      return NextResponse.json(
        { error: "Entrada no encontrada" },
        { status: 404 }
      );
    }

    const allRolesForCheck = await db
      .select({ id: roles.id, dependsOnRoleId: roles.dependsOnRoleId })
      .from(roles)
      .where(eq(roles.groupId, schedule.groupId));

    if (!isDependentRole(entry.roleId, allRolesForCheck)) {
      return NextResponse.json(
        { error: "El rol de la entrada no es un rol dependiente" },
        { status: 400 }
      );
    }

    await db.delete(scheduleDateAssignments)
      .where(eq(scheduleDateAssignments.id, body.entryId));

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Bulk update entries: replaces all entries for the schedule. Entries keyed by scheduleDateId.
  if (body.action === "bulk_update" && Array.isArray(body.entries)) {
    const allRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.groupId, schedule.groupId));
    const dependentRoleIdSet = getDependentRoleIds(allRoles);

    const scheduleDatesForSchedule = await db
      .select({ id: scheduleDate.id, date: scheduleDate.date })
      .from(scheduleDate)
      .where(eq(scheduleDate.scheduleId, scheduleId));
    const validSdIds = new Set(scheduleDatesForSchedule.map((sd) => sd.id));

    const oldEntriesWithDate = await db
      .select({
        id: scheduleDateAssignments.id,
        scheduleDateId: scheduleDateAssignments.scheduleDateId,
        date: scheduleDate.date,
        roleId: scheduleDateAssignments.roleId,
        memberId: scheduleDateAssignments.memberId,
      })
      .from(scheduleDateAssignments)
      .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
      .where(eq(scheduleDate.scheduleId, scheduleId));

    const regularEntries: Array<{ scheduleDateId: number; roleId: number; memberId: number | null }> = [];
    const dependentEntries: Array<{ scheduleDateId: number; roleId: number; memberId: number | null }> = [];

    for (const entry of body.entries) {
      const scheduleDateId =
        entry.scheduleDateId ??
        (typeof entry.date === "string"
          ? scheduleDatesForSchedule.find((sd) => sd.date === entry.date)?.id
          : undefined);
      if (scheduleDateId == null || !validSdIds.has(scheduleDateId)) continue;
      const e = {
        scheduleDateId,
        roleId: entry.roleId,
        memberId: entry.memberId ?? null,
      };
      if (dependentRoleIdSet.has(entry.roleId)) {
        dependentEntries.push(e);
      } else {
        regularEntries.push(e);
      }
    }

    const allSdIds = scheduleDatesForSchedule.map((sd) => sd.id);
    if (allSdIds.length > 0) {
      await db.delete(scheduleDateAssignments).where(
        inArray(scheduleDateAssignments.scheduleDateId, allSdIds)
      );
    }

    const toInsert = [...regularEntries, ...dependentEntries]
      .filter((e) => e.memberId != null)
      .map((e) => ({
        scheduleDateId: e.scheduleDateId,
        roleId: e.roleId,
        memberId: e.memberId!,
      }));

    if (toInsert.length > 0) {
      await db.insert(scheduleDateAssignments).values(toInsert);
    }

    const allMembers = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(eq(members.groupId, schedule.groupId));
    const memberMap = new Map(allMembers.map((m) => [m.id, m.name]));
    const roleMap = new Map(allRoles.map((r) => [r.id, r.name]));

    const oldBySlot = new Map<string, number>();
    const oldSlotCount = new Map<string, number>();
    for (const e of oldEntriesWithDate) {
      const baseKey = `${e.scheduleDateId}|${e.roleId}`;
      const idx = oldSlotCount.get(baseKey) ?? 0;
      oldBySlot.set(`${baseKey}|${idx}`, e.memberId);
      oldSlotCount.set(baseKey, idx + 1);
    }

    const newBySlot = new Map<string, number | null>();
    const newSlotCount = new Map<string, number>();
    for (const e of body.entries) {
      const scheduleDateId =
        e.scheduleDateId ??
        (typeof e.date === "string"
          ? scheduleDatesForSchedule.find((sd) => sd.date === e.date)?.id
          : undefined);
      if (scheduleDateId == null) continue;
      const baseKey = `${scheduleDateId}|${e.roleId}`;
      const idx = newSlotCount.get(baseKey) ?? 0;
      newBySlot.set(`${baseKey}|${idx}`, e.memberId ?? null);
      newSlotCount.set(baseKey, idx + 1);
    }

    const dateBySdId = new Map(scheduleDatesForSchedule.map((sd) => [sd.id, sd.date]));
    const changes: { date: string; role: string; from: string | null; to: string | null }[] = [];
    const allKeys = new Set([...oldBySlot.keys(), ...newBySlot.keys()]);
    for (const key of allKeys) {
      const oldMid = oldBySlot.get(key) ?? null;
      const newMid = newBySlot.get(key) ?? null;
      if (oldMid !== newMid) {
        const [sdIdStr, roleIdStr] = key.split("|");
        const date = dateBySdId.get(parseInt(sdIdStr, 10)) ?? "?";
        changes.push({
          date,
          role: roleMap.get(parseInt(roleIdStr, 10)) ?? "?",
          from: oldMid != null ? (memberMap.get(oldMid) ?? "?") : null,
          to: newMid != null ? (memberMap.get(newMid) ?? "?") : null,
        });
      }
    }

    if (changes.length > 0) {
      await logScheduleAction(scheduleId, authResult.user.id, "bulk_update", {
        message: `Cambios guardados: ${changes.length} asignacion${changes.length === 1 ? "" : "es"} actualizada${changes.length === 1 ? "" : "s"}`,
        changes,
      });
    }

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Rebuild: preview or apply
  if (
    (body.action === "rebuild_preview" || body.action === "rebuild_apply") &&
    (body.mode === "overwrite" || body.mode === "fill_empty")
  ) {
    const { mode } = body;
    const { groupId } = schedule;
    const today = new Date().toISOString().split("T")[0];

    const config = await loadScheduleConfig(groupId);

    const assignableDatesRows = await db
      .select({ date: scheduleDate.date, id: scheduleDate.id, recurringEventId: scheduleDate.recurringEventId })
      .from(scheduleDate)
      .where(
        and(
          eq(scheduleDate.scheduleId, scheduleId),
          eq(scheduleDate.type, "assignable")
        )
      );
    const allRegularDates = [...new Set(assignableDatesRows.map((r) => r.date))].sort();

    const futureDates = filterRebuildableDates(allRegularDates, today);

    if (futureDates.length === 0) {
      return NextResponse.json(
        { error: "No hay fechas futuras para reconstruir" },
        { status: 400 }
      );
    }

    const currentEntriesWithDate = await db
      .select({
        id: scheduleDateAssignments.id,
        scheduleDateId: scheduleDateAssignments.scheduleDateId,
        date: scheduleDate.date,
        roleId: scheduleDateAssignments.roleId,
        memberId: scheduleDateAssignments.memberId,
      })
      .from(scheduleDateAssignments)
      .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
      .where(eq(scheduleDate.scheduleId, scheduleId));

    const pastEntries = currentEntriesWithDate.filter((e) => e.date < today);
    const futureEntries = currentEntriesWithDate.filter((e) => e.date >= today);

    const previousAssignments = await getPreviousAssignments(groupId);
    const allPrevious = [
      ...previousAssignments,
      ...pastEntries.map((e) => ({ date: e.date, roleId: e.roleId, memberId: e.memberId })),
    ];

    let datesToGenerate: string[];

    if (mode === "overwrite") {
      datesToGenerate = futureDates;
    } else {
      datesToGenerate = computeDatesWithGaps({
        dates: futureDates,
        currentAssignments: futureEntries,
        roleDefinitions: config.roleDefinitions,
        dependentRoleIds: config.dependentRoleIds,
      });

      allPrevious.push(
        ...futureEntries.map((e) => ({ date: e.date, roleId: e.roleId, memberId: e.memberId }))
      );
    }

    if (datesToGenerate.length === 0) {
      return NextResponse.json({
        preview: [],
        removedCount: 0,
      });
    }

    const result = generateGroupSchedule({
      dates: datesToGenerate,
      events: config.recurringEvents,
      roles: config.roleDefinitions,
      members: config.memberInfos,
      previousAssignments: allPrevious,
    });

    const memberMap = new Map(config.memberInfos.map((m) => [m.id, m.name]));
    const roleMap = new Map(config.allRoles.map((r) => [r.id, r.name]));

    const preview = result.assignments.map((a) => ({
      date: a.date,
      roleId: a.roleId,
      roleName: roleMap.get(a.roleId) ?? "Desconocido",
      memberId: a.memberId,
      memberName: memberMap.get(a.memberId) ?? "Desconocido",
    }));

    const removedCount = mode === "overwrite" ? futureEntries.length : 0;

    if (body.action === "rebuild_preview") {
      return NextResponse.json({ preview, removedCount });
    }

    // rebuild_apply: persist
    if (mode === "overwrite") {
      for (const e of futureEntries) {
        await db.delete(scheduleDateAssignments).where(eq(scheduleDateAssignments.id, e.id));
      }
    }

    // Build lookup: date|recurringEventId -> schedule_date id
    const sdIdByKey = new Map<string, number>();
    for (const r of assignableDatesRows) {
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

    const modeLabel = mode === "overwrite" ? "regenerar todo" : "llenar vacios";
    await logScheduleAction(scheduleId, authResult.user.id, "rebuild", {
      message: `Reconstruccion aplicada (${modeLabel}): ${preview.length} asignacion${preview.length === 1 ? "" : "es"} nueva${preview.length === 1 ? "" : "s"}`,
      mode,
      removedCount,
      added: preview,
    });

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Add a date (one more schedule_date row; multiple events per calendar day allowed)
  if (body.action === "add_date" && body.date) {
    const dateStr = body.date as string;
    const type = (body.type as string) ?? "assignable";
    const label = type === "for_everyone" ? ((body.label as string) ?? "Ensayo") : null;

    if (type !== "assignable" && type !== "for_everyone") {
      return apiError("Tipo inválido", 400, "VALIDATION");
    }

    const dateValidation = validateDateInScheduleMonth({
      date: dateStr,
      month: schedule.month,
      year: schedule.year,
    });
    if (!dateValidation.valid) {
      return apiError(dateValidation.reason, 400, "VALIDATION");
    }

    await db.insert(scheduleDate).values({
      scheduleId,
      date: dateStr,
      type,
      label,
      note: null,
      startTimeUtc: "00:00",
      endTimeUtc: "23:59",
      recurringEventId: null,
    });

    const typeLabel = type === "assignable" ? "Asignación" : (label ?? "Actividad");
    await logScheduleAction(scheduleId, authResult.user.id, "add_date", `Fecha agregada: ${dateStr} (${typeLabel})`);

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Update a schedule date (time and/or note). Identify by scheduleDateId (preferred) or date.
  if (body.action === "update_date") {
    const startTimeUtc = body.startTimeUtc as string | undefined;
    const endTimeUtc = body.endTimeUtc as string | undefined;
    const note = body.note as string | undefined;

    let sd: { id: number; date: string } | undefined;
    if (body.scheduleDateId != null) {
      sd = (await db
        .select({ id: scheduleDate.id, date: scheduleDate.date })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.id, body.scheduleDateId),
            eq(scheduleDate.scheduleId, scheduleId)
          )
        ))[0];
    } else if (body.date) {
      sd = (await db
        .select({ id: scheduleDate.id, date: scheduleDate.date })
        .from(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, scheduleId),
            eq(scheduleDate.date, body.date)
          )
        )
        .orderBy(asc(scheduleDate.startTimeUtc)))[0];
    }

    if (!sd) {
      return NextResponse.json(
        { error: "Fecha no encontrada en el cronograma" },
        { status: 404 }
      );
    }

    const updates: Partial<{ startTimeUtc: string; endTimeUtc: string; note: string | null }> = {};
    if (startTimeUtc !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(startTimeUtc)) {
        return apiError("startTimeUtc debe ser HH:MM", 400, "VALIDATION");
      }
      updates.startTimeUtc = startTimeUtc;
    }
    if (endTimeUtc !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(endTimeUtc)) {
        return apiError("endTimeUtc debe ser HH:MM", 400, "VALIDATION");
      }
      updates.endTimeUtc = endTimeUtc;
    }
    if (note !== undefined) {
      updates.note = note === "" || note == null ? null : String(note).trim();
    }

    if (Object.keys(updates).length > 0) {
      await db.update(scheduleDate).set(updates).where(eq(scheduleDate.id, sd.id));
      await logScheduleAction(scheduleId, authResult.user.id, "date_updated", `Fecha actualizada: ${sd.date}`);
    }

    await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    return NextResponse.json({ success: true });
  }

  // Remove a date: by scheduleDateId (one event) or by date (all events on that day)
  if (body.action === "remove_date") {
    if (body.scheduleDateId != null) {
      const deleted = await db
        .delete(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, scheduleId),
            eq(scheduleDate.id, body.scheduleDateId)
          )
        )
        .returning({ id: scheduleDate.id, date: scheduleDate.date });

      if (deleted.length === 0) {
        return NextResponse.json(
          { error: "Fecha no encontrada" },
          { status: 404 }
        );
      }
      await logScheduleAction(scheduleId, authResult.user.id, "remove_date", `Evento eliminado: ${deleted[0].date}`);
      await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    } else if (body.date) {
      const dateStr = body.date as string;
      const deleted = await db
        .delete(scheduleDate)
        .where(
          and(
            eq(scheduleDate.scheduleId, scheduleId),
            eq(scheduleDate.date, dateStr)
          )
        )
        .returning({ id: scheduleDate.id });

      if (deleted.length === 0) {
        return NextResponse.json(
          { error: "Fecha no encontrada" },
          { status: 404 }
        );
      }
      await logScheduleAction(scheduleId, authResult.user.id, "remove_date", `Fecha eliminada: ${dateStr}`);
      await revalidateCronograma(schedule.groupId, schedule.month, schedule.year);
    } else {
      return apiError("Indica scheduleDateId o date", 400, "VALIDATION");
    }
    return NextResponse.json({ success: true });
  }

  return apiError("Acción inválida", 400, "VALIDATION");
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const { id } = await params;
  const scheduleId = parseInt(id, 10);

  const existing = (await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, scheduleId)))[0];

  if (!existing) {
    return apiError("Cronograma no encontrado", 404, "NOT_FOUND");
  }

  const delAccess = await hasGroupAccess(authResult.user.id, existing.groupId);
  if (!delAccess) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  await db.delete(schedules).where(eq(schedules.id, scheduleId));
  await revalidateCronograma(existing.groupId, existing.month, existing.year);
  return NextResponse.json({ success: true });
}
