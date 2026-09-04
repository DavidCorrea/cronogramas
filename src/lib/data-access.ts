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
import { findHolidayConflicts, loadConflictingHolidays } from "@/lib/holiday-conflicts";
import { monthRange } from "@/lib/month-range";

// ── User-scoped ──

export async function loadUserGroups(userId: string) {
  // The three membership lookups are independent; this is the dashboard's
  // critical path, so they run together.
  const [ownedGroups, collabGroups, memberGroups] = await Promise.all([
    db.select({ id: groups.id }).from(groups).where(eq(groups.ownerId, userId)),
    db
      .select({ groupId: groupCollaborators.groupId })
      .from(groupCollaborators)
      .where(eq(groupCollaborators.userId, userId)),
    db
      .select({ groupId: members.groupId })
      .from(members)
      .where(eq(members.userId, userId)),
  ]);

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
  // memberId is not used by the settings view; select only the displayed columns.
  return db
    .select({
      id: holidays.id,
      userId: holidays.userId,
      startDate: holidays.startDate,
      endDate: holidays.endDate,
      description: holidays.description,
    })
    .from(holidays)
    .where(eq(holidays.userId, userId));
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

  const [memberRolesList, availability] = await Promise.all([
    db
      .select({ roleId: memberRoles.roleId })
      .from(memberRoles)
      .where(eq(memberRoles.memberId, memberId)),
    db
      .select({
        weekdayId: memberAvailability.weekdayId,
        startTimeUtc: memberAvailability.startTimeUtc,
        endTimeUtc: memberAvailability.endTimeUtc,
      })
      .from(memberAvailability)
      .where(eq(memberAvailability.memberId, memberId)),
  ]);

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

  const groupMemberIds = db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.groupId, groupId));

  const groupUserIds = db
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.groupId, groupId), isNotNull(members.userId)));

  // The holiday queries are scoped by subquery rather than by ids from the
  // members query, so all three run in a single round trip.
  const [groupMembers, memberHolidays, userHolidays] = await Promise.all([
    db
      .select({ id: members.id, name: members.name, userId: members.userId })
      .from(members)
      .where(eq(members.groupId, groupId)),
    db
      .select()
      .from(holidays)
      .where(
        and(
          inArray(holidays.memberId, groupMemberIds),
          isNotNull(holidays.memberId),
          gte(holidays.endDate, today),
        ),
      ),
    db
      .select()
      .from(holidays)
      .where(
        and(
          inArray(holidays.userId, groupUserIds),
          isNotNull(holidays.userId),
          gte(holidays.endDate, today),
        ),
      ),
  ]);

  if (groupMembers.length === 0) return [];

  const linkedMembers = groupMembers.filter((m) => m.userId != null);
  const memberNameById = new Map(groupMembers.map((m) => [m.id, m.name]));
  const memberNameByUserId = new Map(linkedMembers.map((m) => [m.userId!, m.name]));

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
    memberName: memberNameById.get(h.memberId!) ?? "Desconocido",
    source: "member" as const,
  }));

  for (const h of userHolidays) {
    result.push({
      id: h.id,
      memberId: null,
      userId: h.userId,
      startDate: h.startDate,
      endDate: h.endDate,
      description: h.description,
      memberName: memberNameByUserId.get(h.userId!) ?? "Desconocido",
      source: "user" as const,
    });
  }

  result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return result;
}

export async function loadGroupCollaborators(groupId: number) {
  // The owner comes back via a join rather than a group lookup followed by a
  // user lookup, so both halves of this view load in one round trip.
  const [collabs, owner] = await Promise.all([
    db
      .select({
        id: groupCollaborators.id,
        userId: groupCollaborators.userId,
        userName: users.name,
        userEmail: users.email,
        userImage: users.image,
      })
      .from(groupCollaborators)
      .innerJoin(users, eq(groupCollaborators.userId, users.id))
      .where(eq(groupCollaborators.groupId, groupId)),
    db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image })
      .from(groups)
      .innerJoin(users, eq(groups.ownerId, users.id))
      .where(eq(groups.id, groupId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return { owner: owner ?? null, collaborators: collabs };
}

/**
 * Load a single recurring event with its weekday name. Returns null if missing.
 * Use for the event edit page instead of loading the whole event catalog.
 */
export async function loadRecurringEventById(eventId: number) {
  const row = (
    await db
      .select({
        id: recurringEvents.id,
        weekdayId: recurringEvents.weekdayId,
        dayOfWeek: weekdays.name,
        active: recurringEvents.active,
        type: recurringEvents.type,
        label: recurringEvents.label,
        startTimeUtc: recurringEvents.startTimeUtc,
        endTimeUtc: recurringEvents.endTimeUtc,
        groupId: recurringEvents.groupId,
        notes: recurringEvents.notes,
      })
      .from(recurringEvents)
      .innerJoin(weekdays, eq(recurringEvents.weekdayId, weekdays.id))
      .where(eq(recurringEvents.id, eventId))
  )[0];

  return row ?? null;
}

/**
 * Load event–role priorities for a group. When recurringEventId is provided,
 * scope to that single event (used by the event edit page) instead of loading
 * every assignable event's priorities.
 */
export async function loadEventPriorities(groupId: number, recurringEventId?: number) {
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
    .where(
      recurringEventId != null
        ? and(eq(recurringEvents.groupId, groupId), eq(recurringEvents.id, recurringEventId))
        : eq(recurringEvents.groupId, groupId),
    );

  const assignableDays = allRecurring.filter((d) => d.type === "assignable");
  const assignableIds = new Set(assignableDays.map((d) => d.id));
  // Scope priorities to this group's assignable events instead of scanning the
  // whole event_role_priorities table and filtering in memory. The roles query
  // is independent of the events, so both run together.
  const recurringEventIds = [...assignableIds];
  const [allRoles, allPriorities] = await Promise.all([
    db.select().from(roles).where(eq(roles.groupId, groupId)),
    recurringEventIds.length > 0
      ? db
          .select()
          .from(eventRolePriorities)
          .where(inArray(eventRolePriorities.recurringEventId, recurringEventIds))
      : Promise.resolve([]),
  ]);

  const dayOfWeekByEventId = new Map(assignableDays.map((d) => [d.id, d.dayOfWeek]));
  const roleNameById = new Map(allRoles.map((r) => [r.id, r.name]));

  return allPriorities
    .filter((p) => roleNameById.has(p.roleId))
    .map((p) => ({
      ...p,
      dayOfWeek: dayOfWeekByEventId.get(p.recurringEventId) ?? "Unknown",
      roleName: roleNameById.get(p.roleId) ?? "Unknown",
    }));
}

// ── Schedule detail ──

export async function loadScheduleDetail(scheduleId: number) {
  const schedule = (
    await db.select().from(schedules).where(eq(schedules.id, scheduleId))
  )[0];
  if (!schedule) return null;

  const { month, year, groupId } = schedule;
  const { start: monthStart, end: monthEnd } = monthRange(year, month);

  // One round trip for everything the page needs: nothing here depends on
  // another query's result, so none of it should be sequenced.
  const [
    allMembers,
    allRoles,
    entriesWithDate,
    scheduleDatesRows,
    prevSchedule,
    nextSchedule,
    conflictingHolidays,
    auditLogRows,
  ] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.name,
        groupId: members.groupId,
        // userId is needed to match user-scoped holidays to this group's members.
        userId: members.userId,
      })
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
    loadConflictingHolidays(groupId, monthStart, monthEnd),
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

  const memberNameById = new Map(allMembers.map((m) => [m.id, m.name]));
  const roleNameById = new Map(allRoles.map((r) => [r.id, r.name]));

  const enrichedEntries = entriesWithDate.map((entry) => ({
    id: entry.id,
    scheduleDateId: entry.scheduleDateId,
    date: entry.date,
    roleId: entry.roleId,
    memberId: entry.memberId,
    memberName: memberNameById.get(entry.memberId) ?? "Desconocido",
    roleName: roleNameById.get(entry.roleId) ?? "Desconocido",
  }));

  const entriesByScheduleDateId = new Map<number, typeof enrichedEntries>();
  for (const entry of enrichedEntries) {
    const list = entriesByScheduleDateId.get(entry.scheduleDateId) ?? [];
    list.push(entry);
    entriesByScheduleDateId.set(entry.scheduleDateId, list);
  }

  const holidayConflicts = findHolidayConflicts(
    enrichedEntries.map((e) => ({ date: e.date, memberId: e.memberId })),
    allMembers.map((m) => ({ id: m.id, name: m.name, userId: m.userId })),
    conflictingHolidays,
  );

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
      entries: entriesByScheduleDateId.get(sd.id) ?? [],
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
