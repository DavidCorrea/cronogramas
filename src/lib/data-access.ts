import { db } from "@/lib/db";
import {
  groups,
  groupCollaborators,
  members,
  memberRoles,
  memberAvailability,
  users,
  holidays,
  roles,
  recurringEvents,
  weekdays,
  eventRolePriorities,
  schedules,
  scheduleDate,
  scheduleDateAssignments,
  scheduleAuditLog,
} from "@/db/schema";
import { eq, and, inArray, isNotNull, gte, asc, desc, lt, gt, or, count } from "drizzle-orm";
import { getHolidayConflicts } from "@/lib/holiday-conflicts";

// ── User-scoped ──

export async function loadUserGroups(userId: string) {
  const ownedGroups = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.ownerId, userId));

  const collabGroups = await db
    .select({ groupId: groupCollaborators.groupId })
    .from(groupCollaborators)
    .where(eq(groupCollaborators.userId, userId));

  const memberGroups = await db
    .select({ groupId: members.groupId })
    .from(members)
    .where(eq(members.userId, userId));

  const groupIds = [
    ...new Set([
      ...ownedGroups.map((g) => g.id),
      ...collabGroups.map((g) => g.groupId),
      ...memberGroups.map((g) => g.groupId),
    ]),
  ];

  if (groupIds.length === 0) return [];

  const allGroups = await db
    .select()
    .from(groups)
    .where(inArray(groups.id, groupIds))
    .orderBy(groups.name);

  return allGroups.map((g) => ({
    ...g,
    role: g.ownerId === userId
      ? ("owner" as const)
      : collabGroups.some((c) => c.groupId === g.id)
        ? ("collaborator" as const)
        : ("member" as const),
  }));
}

export async function loadUserHolidays(userId: string) {
  return db.select().from(holidays).where(eq(holidays.userId, userId));
}

// ── Member ──

export async function loadMemberById(memberId: number) {
  const member = (
    await db
      .select({
        id: members.id,
        name: members.name,
        memberEmail: members.email,
        userId: members.userId,
        groupId: members.groupId,
        userEmail: users.email,
        userImage: users.image,
        userName: users.name,
      })
      .from(members)
      .leftJoin(users, eq(members.userId, users.id))
      .where(eq(members.id, memberId))
  )[0];

  if (!member) return null;

  const memberRolesList = await db
    .select()
    .from(memberRoles)
    .where(eq(memberRoles.memberId, memberId));

  const availability = await db
    .select({
      weekdayId: memberAvailability.weekdayId,
      startTimeUtc: memberAvailability.startTimeUtc,
      endTimeUtc: memberAvailability.endTimeUtc,
    })
    .from(memberAvailability)
    .where(eq(memberAvailability.memberId, memberId));

  return {
    id: member.id,
    name: member.name,
    memberEmail: member.memberEmail,
    userId: member.userId,
    groupId: member.groupId,
    email: member.userEmail,
    image: member.userImage,
    userName: member.userName,
    roleIds: memberRolesList.map((r) => r.roleId),
    availability: availability.map((a) => ({
      weekdayId: a.weekdayId,
      startTimeUtc: a.startTimeUtc ?? "00:00",
      endTimeUtc: a.endTimeUtc ?? "23:59",
    })),
    availableDayIds: [...new Set(availability.map((a) => a.weekdayId))],
  };
}

// ── Group-scoped config ──

export async function loadGroupHolidays(groupId: number) {
  const today = new Date().toISOString().split("T")[0];

  const groupMembers = await db
    .select({ id: members.id, name: members.name, userId: members.userId })
    .from(members)
    .where(eq(members.groupId, groupId));

  const memberIds = groupMembers.map((m) => m.id);
  if (memberIds.length === 0) return [];

  const memberHolidays = await db
    .select()
    .from(holidays)
    .where(
      and(
        inArray(holidays.memberId, memberIds),
        isNotNull(holidays.memberId),
        gte(holidays.endDate, today),
      ),
    );

  const result: Array<{
    id: number;
    memberId: number | null;
    userId: string | null;
    startDate: string;
    endDate: string;
    description: string | null;
    memberName: string;
    source: "member" | "user";
  }> = memberHolidays.map((h) => ({
    id: h.id,
    memberId: h.memberId,
    userId: h.userId,
    startDate: h.startDate,
    endDate: h.endDate,
    description: h.description,
    memberName: groupMembers.find((m) => m.id === h.memberId)?.name ?? "Desconocido",
    source: "member" as const,
  }));

  const linkedMembers = groupMembers.filter((m) => m.userId != null);
  if (linkedMembers.length > 0) {
    const linkedUserIds = linkedMembers.map((m) => m.userId!);
    const userHolidays = await db
      .select()
      .from(holidays)
      .where(
        and(
          inArray(holidays.userId, linkedUserIds),
          isNotNull(holidays.userId),
          gte(holidays.endDate, today),
        ),
      );
    for (const h of userHolidays) {
      const member = linkedMembers.find((m) => m.userId === h.userId);
      result.push({
        id: h.id,
        memberId: null,
        userId: h.userId,
        startDate: h.startDate,
        endDate: h.endDate,
        description: h.description,
        memberName: member?.name ?? "Desconocido",
        source: "user" as const,
      });
    }
  }

  result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return result;
}

export async function loadGroupCollaborators(groupId: number) {
  const collabs = await db
    .select({
      id: groupCollaborators.id,
      userId: groupCollaborators.userId,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(groupCollaborators)
    .innerJoin(users, eq(groupCollaborators.userId, users.id))
    .where(eq(groupCollaborators.groupId, groupId));

  const group = (
    await db
      .select({ ownerId: groups.ownerId })
      .from(groups)
      .where(eq(groups.id, groupId))
  )[0];

  const owner = group
    ? (
        await db
          .select({ id: users.id, name: users.name, email: users.email, image: users.image })
          .from(users)
          .where(eq(users.id, group.ownerId))
      )[0]
    : null;

  return { owner: owner ?? null, collaborators: collabs };
}

export async function loadEventPriorities(groupId: number) {
  const allRecurring = await db
    .select({
      id: recurringEvents.id,
      weekdayId: recurringEvents.weekdayId,
      dayOfWeek: weekdays.name,
      active: recurringEvents.active,
      type: recurringEvents.type,
      label: recurringEvents.label,
      groupId: recurringEvents.groupId,
    })
    .from(recurringEvents)
    .innerJoin(weekdays, eq(recurringEvents.weekdayId, weekdays.id))
    .where(eq(recurringEvents.groupId, groupId));

  const assignableDays = allRecurring.filter((d) => d.type === "assignable");

  const allRoles = await db.select().from(roles).where(eq(roles.groupId, groupId));

  const assignableIds = new Set(assignableDays.map((d) => d.id));
  const roleIds = new Set(allRoles.map((r) => r.id));

  // Scope priorities to this group's assignable events (and roles) instead of
  // scanning the whole event_role_priorities table and filtering in memory.
  const recurringEventIds = [...assignableIds];
  const allPriorities = recurringEventIds.length > 0
    ? await db
        .select()
        .from(eventRolePriorities)
        .where(inArray(eventRolePriorities.recurringEventId, recurringEventIds))
    : [];

  const filtered = allPriorities.filter(
    (p) => assignableIds.has(p.recurringEventId) && roleIds.has(p.roleId),
  );

  return filtered.map((p) => ({
    ...p,
    dayOfWeek: assignableDays.find((d) => d.id === p.recurringEventId)?.dayOfWeek ?? "Unknown",
    roleName: allRoles.find((r) => r.id === p.roleId)?.name ?? "Unknown",
  }));
}

// ── Schedule detail ──

export async function loadScheduleDetail(scheduleId: number) {
  const schedule = (
    await db.select().from(schedules).where(eq(schedules.id, scheduleId))
  )[0];
  if (!schedule) return null;

  const { month, year, groupId } = schedule;

  const [allMembers, allRoles, entriesWithDate, scheduleDatesRows] = await Promise.all([
    db
      .select({ id: members.id, name: members.name, groupId: members.groupId })
      .from(members)
      .where(eq(members.groupId, groupId)),
    db.select().from(roles).where(eq(roles.groupId, groupId)),
    db
      .select({
        id: scheduleDateAssignments.id,
        scheduleDateId: scheduleDateAssignments.scheduleDateId,
        date: scheduleDate.date,
        roleId: scheduleDateAssignments.roleId,
        memberId: scheduleDateAssignments.memberId,
      })
      .from(scheduleDateAssignments)
      .innerJoin(scheduleDate, eq(scheduleDateAssignments.scheduleDateId, scheduleDate.id))
      .where(eq(scheduleDate.scheduleId, scheduleId)),
    db
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
      .orderBy(asc(scheduleDate.date), asc(scheduleDate.startTimeUtc)),
  ]);

  const enrichedEntries = entriesWithDate.map((entry) => ({
    id: entry.id,
    scheduleDateId: entry.scheduleDateId,
    date: entry.date,
    roleId: entry.roleId,
    memberId: entry.memberId,
    memberName: allMembers.find((m) => m.id === entry.memberId)?.name ?? "Desconocido",
    roleName: allRoles.find((r) => r.id === entry.roleId)?.name ?? "Desconocido",
  }));

  const [prevSchedule, nextSchedule, holidayConflicts, auditLogRows] = await Promise.all([
    db
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, groupId),
          or(lt(schedules.year, year), and(eq(schedules.year, year), lt(schedules.month, month))),
        ),
      )
      .orderBy(desc(schedules.year), desc(schedules.month))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: schedules.id })
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, groupId),
          or(gt(schedules.year, year), and(eq(schedules.year, year), gt(schedules.month, month))),
        ),
      )
      .orderBy(asc(schedules.year), asc(schedules.month))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getHolidayConflicts(
      enrichedEntries.map((e) => ({ date: e.date, memberId: e.memberId })),
      groupId,
    ),
    db
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
      .orderBy(desc(scheduleAuditLog.createdAt)),
  ]);

  return {
    ...schedule,
    scheduleDates: scheduleDatesRows.map((sd) => ({
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
  };
}

// ── Admin ──

export async function loadAdminUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      isAdmin: users.isAdmin,
      canCreateGroups: users.canCreateGroups,
      canExportCalendars: users.canExportCalendars,
    })
    .from(users)
    .orderBy(users.name);
}

export async function loadAdminGroups() {
  const allGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      ownerId: groups.ownerId,
      calendarExportEnabled: groups.calendarExportEnabled,
    })
    .from(groups)
    .orderBy(groups.name);

  const [memberCounts, scheduleCounts, eventCounts] = await Promise.all([
    db.select({ groupId: members.groupId, count: count() }).from(members).groupBy(members.groupId),
    db.select({ groupId: schedules.groupId, count: count() }).from(schedules).groupBy(schedules.groupId),
    db.select({ groupId: recurringEvents.groupId, count: count() }).from(recurringEvents).groupBy(recurringEvents.groupId),
  ]);

  const byGroup = (rows: { groupId: number; count: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.groupId, Number(r.count)]));

  const membersByGroup = byGroup(memberCounts);
  const schedulesByGroup = byGroup(scheduleCounts);
  const eventsByGroup = byGroup(eventCounts);

  return allGroups.map((g) => ({
    ...g,
    membersCount: membersByGroup[g.id] ?? 0,
    schedulesCount: schedulesByGroup[g.id] ?? 0,
    eventsCount: eventsByGroup[g.id] ?? 0,
  }));
}
