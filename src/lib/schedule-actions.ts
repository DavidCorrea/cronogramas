import { NextResponse } from "next/server";
import { db } from "./db";
import {
  schedules,
  scheduleDateAssignments,
  scheduleDate,
  members,
  roles,
} from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { apiError } from "./api-helpers";
import { loadScheduleConfig, getPreviousAssignments } from "./schedule-helpers";
import {
  generateGroupSchedule,
  validateDependentRoleAssignment,
  computeDatesWithGaps,
  getDependentRoleIds,
  isDependentRole,
  filterRebuildableDates,
  validateDateInScheduleMonth,
} from "./schedule-model";
import { logScheduleAction } from "./audit-log";
import { revalidateCronograma } from "./public-schedule";
import type { ScheduleAction } from "./schemas/schedules";

interface ActionContext {
  scheduleId: number;
  schedule: { groupId: number; month: number; year: number };
  userId: string;
}

type ActionBody<A extends ScheduleAction["action"]> = Extract<ScheduleAction, { action: A }>;

async function revalidate(ctx: ActionContext) {
  await revalidateCronograma(ctx.schedule.groupId, ctx.schedule.month, ctx.schedule.year);
}

export async function commitSchedule(ctx: ActionContext) {
  const updated = await db.update(schedules)
    .set({ status: "committed" })
    .where(eq(schedules.id, ctx.scheduleId))
    .returning();

  await logScheduleAction(ctx.scheduleId, ctx.userId, "published", "Cronograma publicado");
  await revalidate(ctx);

  return NextResponse.json(updated[0] ?? { ...ctx.schedule, id: ctx.scheduleId, status: "committed" });
}

export async function swapAssignment(ctx: ActionContext, body: ActionBody<"swap">) {
  const entry = (await db
    .select()
    .from(scheduleDateAssignments)
    .where(eq(scheduleDateAssignments.id, body.entryId)))[0];

  if (!entry) {
    return apiError("Entrada no encontrada", 404, "NOT_FOUND");
  }

  await db.update(scheduleDateAssignments)
    .set({ memberId: body.newMemberId })
    .where(eq(scheduleDateAssignments.id, body.entryId));

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function removeAssignment(ctx: ActionContext, body: ActionBody<"remove">) {
  const entry = (await db
    .select()
    .from(scheduleDateAssignments)
    .where(eq(scheduleDateAssignments.id, body.entryId)))[0];

  if (!entry) {
    return apiError("Entrada no encontrada", 404, "NOT_FOUND");
  }

  await db.delete(scheduleDateAssignments)
    .where(eq(scheduleDateAssignments.id, body.entryId));

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function assignMember(ctx: ActionContext, body: ActionBody<"assign">) {
  let sd: { id: number } | undefined;
  if (body.scheduleDateId != null) {
    sd = (await db
      .select({ id: scheduleDate.id })
      .from(scheduleDate)
      .where(
        and(
          eq(scheduleDate.id, body.scheduleDateId),
          eq(scheduleDate.scheduleId, ctx.scheduleId)
        )
      ))[0];
  } else if (body.date) {
    sd = (await db
      .select({ id: scheduleDate.id })
      .from(scheduleDate)
      .where(
        and(
          eq(scheduleDate.scheduleId, ctx.scheduleId),
          eq(scheduleDate.date, body.date)
        )
      )
      .orderBy(asc(scheduleDate.startTimeUtc)))[0];
  }

  if (!sd) {
    return apiError("Fecha no encontrada en el cronograma", 404, "NOT_FOUND");
  }

  const allRoles = await db
    .select({ id: roles.id, dependsOnRoleId: roles.dependsOnRoleId })
    .from(roles)
    .where(eq(roles.groupId, ctx.schedule.groupId));

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
    return apiError(validation.reason, 400, "VALIDATION");
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

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function unassignMember(ctx: ActionContext, body: ActionBody<"unassign">) {
  const entry = (await db
    .select()
    .from(scheduleDateAssignments)
    .where(eq(scheduleDateAssignments.id, body.entryId)))[0];

  if (!entry) {
    return apiError("Entrada no encontrada", 404, "NOT_FOUND");
  }

  const allRoles = await db
    .select({ id: roles.id, dependsOnRoleId: roles.dependsOnRoleId })
    .from(roles)
    .where(eq(roles.groupId, ctx.schedule.groupId));

  if (!isDependentRole(entry.roleId, allRoles)) {
    return apiError("El rol de la entrada no es un rol dependiente", 400, "VALIDATION");
  }

  await db.delete(scheduleDateAssignments)
    .where(eq(scheduleDateAssignments.id, body.entryId));

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function bulkUpdateAssignments(ctx: ActionContext, body: ActionBody<"bulk_update">) {
  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.groupId, ctx.schedule.groupId));
  const dependentRoleIdSet = getDependentRoleIds(allRoles);

  const scheduleDatesForSchedule = await db
    .select({ id: scheduleDate.id, date: scheduleDate.date })
    .from(scheduleDate)
    .where(eq(scheduleDate.scheduleId, ctx.scheduleId));
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
    .where(eq(scheduleDate.scheduleId, ctx.scheduleId));

  const regularEntries: Array<{ scheduleDateId: number; roleId: number; memberId: number | null }> = [];
  const dependentEntries: Array<{ scheduleDateId: number; roleId: number; memberId: number | null }> = [];

  for (const entry of body.entries) {
    const scheduleDateId =
      entry.scheduleDateId ??
      (typeof entry.date === "string"
        ? scheduleDatesForSchedule.find((sd) => sd.date === entry.date)?.id
        : undefined);
    if (scheduleDateId == null || !validSdIds.has(scheduleDateId)) continue;
    const mapped = {
      scheduleDateId,
      roleId: entry.roleId,
      memberId: entry.memberId ?? null,
    };
    if (dependentRoleIdSet.has(entry.roleId)) {
      dependentEntries.push(mapped);
    } else {
      regularEntries.push(mapped);
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
    .where(eq(members.groupId, ctx.schedule.groupId));
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
    await logScheduleAction(ctx.scheduleId, ctx.userId, "bulk_update", {
      message: `Cambios guardados: ${changes.length} asignacion${changes.length === 1 ? "" : "es"} actualizada${changes.length === 1 ? "" : "s"}`,
      changes,
    });
  }

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function rebuildSchedule(
  ctx: ActionContext,
  body: ActionBody<"rebuild_preview"> | ActionBody<"rebuild_apply">,
) {
  const { mode } = body;
  const today = new Date().toISOString().split("T")[0];

  const config = await loadScheduleConfig(ctx.schedule.groupId);

  const assignableDatesRows = await db
    .select({ date: scheduleDate.date, id: scheduleDate.id, recurringEventId: scheduleDate.recurringEventId })
    .from(scheduleDate)
    .where(
      and(
        eq(scheduleDate.scheduleId, ctx.scheduleId),
        eq(scheduleDate.type, "assignable")
      )
    );
  const allRegularDates = [...new Set(assignableDatesRows.map((r) => r.date))].sort();

  const futureDates = filterRebuildableDates(allRegularDates, today);

  if (futureDates.length === 0) {
    return apiError("No hay fechas futuras para reconstruir", 400, "VALIDATION");
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
    .where(eq(scheduleDate.scheduleId, ctx.scheduleId));

  const pastEntries = currentEntriesWithDate.filter((e) => e.date < today);
  const futureEntries = currentEntriesWithDate.filter((e) => e.date >= today);

  const previousAssignments = await getPreviousAssignments(ctx.schedule.groupId);
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
    return NextResponse.json({ preview: [], removedCount: 0 });
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

  if (mode === "overwrite" && futureEntries.length > 0) {
    // One delete for the whole set rather than a round trip per assignment.
    await db.delete(scheduleDateAssignments).where(
      inArray(scheduleDateAssignments.id, futureEntries.map((e) => e.id))
    );
  }

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
  await logScheduleAction(ctx.scheduleId, ctx.userId, "rebuild", {
    message: `Reconstruccion aplicada (${modeLabel}): ${preview.length} asignacion${preview.length === 1 ? "" : "es"} nueva${preview.length === 1 ? "" : "s"}`,
    mode,
    removedCount,
    added: preview,
  });

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function addScheduleDate(ctx: ActionContext, body: ActionBody<"add_date">) {
  const dateStr = body.date;
  const type = body.type;
  const label = body.label?.trim() || null;

  const dateValidation = validateDateInScheduleMonth({
    date: dateStr,
    month: ctx.schedule.month,
    year: ctx.schedule.year,
  });
  if (!dateValidation.valid) {
    return apiError(dateValidation.reason, 400, "VALIDATION");
  }

  await db.insert(scheduleDate).values({
    scheduleId: ctx.scheduleId,
    date: dateStr,
    type,
    label,
    note: body.note ?? null,
    startTimeUtc: body.startTimeUtc ?? "00:00",
    endTimeUtc: body.endTimeUtc ?? "23:59",
    recurringEventId: null,
  });

  const typeLabel = type === "assignable" ? "Asignación" : (label ?? "Actividad");
  await logScheduleAction(ctx.scheduleId, ctx.userId, "add_date", `Fecha agregada: ${dateStr} (${typeLabel})`);

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function updateScheduleDate(ctx: ActionContext, body: ActionBody<"update_date">) {
  const { startTimeUtc, endTimeUtc, note, newDate, label } = body;

  let sd: { id: number; date: string } | undefined;
  if (body.scheduleDateId != null) {
    sd = (await db
      .select({ id: scheduleDate.id, date: scheduleDate.date })
      .from(scheduleDate)
      .where(
        and(
          eq(scheduleDate.id, body.scheduleDateId),
          eq(scheduleDate.scheduleId, ctx.scheduleId)
        )
      ))[0];
  } else if (body.date) {
    sd = (await db
      .select({ id: scheduleDate.id, date: scheduleDate.date })
      .from(scheduleDate)
      .where(
        and(
          eq(scheduleDate.scheduleId, ctx.scheduleId),
          eq(scheduleDate.date, body.date)
        )
      )
      .orderBy(asc(scheduleDate.startTimeUtc)))[0];
  }

  if (!sd) {
    return apiError("Fecha no encontrada en el cronograma", 404, "NOT_FOUND");
  }

  const updates: Partial<{ date: string; startTimeUtc: string; endTimeUtc: string; note: string | null; label: string | null; recurringEventId: null }> = {};

  if (newDate !== undefined && newDate !== sd.date) {
    const dateValidation = validateDateInScheduleMonth({
      date: newDate,
      month: ctx.schedule.month,
      year: ctx.schedule.year,
    });
    if (!dateValidation.valid) {
      return apiError(dateValidation.reason, 400, "VALIDATION");
    }
    updates.date = newDate;
    updates.recurringEventId = null;
  }

  if (startTimeUtc !== undefined) updates.startTimeUtc = startTimeUtc;
  if (endTimeUtc !== undefined) updates.endTimeUtc = endTimeUtc;
  if (note !== undefined) {
    updates.note = note === "" ? null : (note?.trim() ?? null);
  }
  if (label !== undefined) {
    updates.label = label === "" ? null : (label?.trim() ?? null);
  }

  if (Object.keys(updates).length > 0) {
    await db.update(scheduleDate).set(updates).where(eq(scheduleDate.id, sd.id));
    const detail = updates.date
      ? `Fecha movida: ${sd.date} → ${updates.date}`
      : `Fecha actualizada: ${sd.date}`;
    await logScheduleAction(ctx.scheduleId, ctx.userId, "date_updated", detail);
  }

  await revalidate(ctx);
  return NextResponse.json({ success: true });
}

export async function removeScheduleDate(ctx: ActionContext, body: ActionBody<"remove_date">) {
  if (body.scheduleDateId != null) {
    const deleted = await db
      .delete(scheduleDate)
      .where(
        and(
          eq(scheduleDate.scheduleId, ctx.scheduleId),
          eq(scheduleDate.id, body.scheduleDateId)
        )
      )
      .returning({ id: scheduleDate.id, date: scheduleDate.date });

    if (deleted.length === 0) {
      return apiError("Fecha no encontrada", 404, "NOT_FOUND");
    }
    await logScheduleAction(ctx.scheduleId, ctx.userId, "remove_date", `Evento eliminado: ${deleted[0].date}`);
    await revalidate(ctx);
  } else if (body.date) {
    const deleted = await db
      .delete(scheduleDate)
      .where(
        and(
          eq(scheduleDate.scheduleId, ctx.scheduleId),
          eq(scheduleDate.date, body.date)
        )
      )
      .returning({ id: scheduleDate.id });

    if (deleted.length === 0) {
      return apiError("Fecha no encontrada", 404, "NOT_FOUND");
    }
    await logScheduleAction(ctx.scheduleId, ctx.userId, "remove_date", `Fecha eliminada: ${body.date}`);
    await revalidate(ctx);
  } else {
    return apiError("Indica scheduleDateId o date", 400, "VALIDATION");
  }
  return NextResponse.json({ success: true });
}
