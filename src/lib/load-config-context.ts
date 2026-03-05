import { db } from "@/lib/db";
import {
  groups,
  members,
  memberRoles,
  memberAvailability,
  users,
  roles,
  recurringEvents,
  weekdays,
  exclusiveGroups,
  schedules,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { dayIndex } from "@/lib/constants";

export const CONFIG_CONTEXT_SLICES = [
  "members",
  "roles",
  "days",
  "exclusiveGroups",
  "schedules",
] as const;
export type ConfigContextSlice = (typeof CONFIG_CONTEXT_SLICES)[number];

export interface ConfigContextPayload {
  group: { id: number; name: string; slug: string };
  members?: Awaited<ReturnType<typeof loadMembers>>;
  roles?: typeof roles.$inferSelect[];
  days?: Array<{
    id: number;
    weekdayId: number;
    dayOfWeek: string | null;
    active: boolean;
    type: string;
    label: string | null;
    startTimeUtc: string | null;
    endTimeUtc: string | null;
    groupId: number;
    notes: string | null;
  }>;
  exclusiveGroups?: typeof exclusiveGroups.$inferSelect[];
  schedules?: typeof schedules.$inferSelect[];
}

export interface LoadConfigContextOptions {
  /** When set, only load these slices (and always group). Omit for full context. */
  include?: ConfigContextSlice[];
}

/**
 * Load config context for a group. When include is set, only those slices are loaded (view-scoped).
 * Does not perform auth; caller must ensure access.
 */
export async function loadConfigContextForGroup(
  groupId: number,
  options?: LoadConfigContextOptions
): Promise<ConfigContextPayload | null> {
  const includeSet =
    options?.include && options.include.length > 0
      ? new Set(options.include)
      : null;

  const group = (
    await db
      .select({ id: groups.id, name: groups.name, slug: groups.slug })
      .from(groups)
      .where(eq(groups.id, groupId))
  )[0];

  if (!group) return null;

  const loadAll = !includeSet;

  const [allMembers, allRoles, allDaysRows, allExclusiveGroups, allSchedules] =
    await Promise.all([
      loadAll || includeSet.has("members") ? loadMembers(groupId) : Promise.resolve(undefined),
      loadAll || includeSet.has("roles")
        ? db
            .select()
            .from(roles)
            .where(eq(roles.groupId, groupId))
            .orderBy(roles.displayOrder)
        : Promise.resolve(undefined),
      loadAll || includeSet.has("days")
        ? db
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
            .where(eq(recurringEvents.groupId, groupId))
        : Promise.resolve(undefined),
      loadAll || includeSet.has("exclusiveGroups")
        ? db
            .select()
            .from(exclusiveGroups)
            .where(eq(exclusiveGroups.groupId, groupId))
            .orderBy(exclusiveGroups.name)
        : Promise.resolve(undefined),
      loadAll || includeSet.has("schedules")
        ? db
            .select()
            .from(schedules)
            .where(eq(schedules.groupId, groupId))
            .orderBy(schedules.year, schedules.month)
        : Promise.resolve(undefined),
    ]);

  const days =
    allDaysRows != null
      ? [...allDaysRows].sort(
          (a, b) => dayIndex(a.dayOfWeek ?? "") - dayIndex(b.dayOfWeek ?? "")
        )
      : undefined;

  return {
    group: { id: group.id, name: group.name, slug: group.slug },
    ...(allMembers !== undefined && { members: allMembers }),
    ...(allRoles !== undefined && { roles: allRoles }),
    ...(days !== undefined && { days }),
    ...(allExclusiveGroups !== undefined && { exclusiveGroups: allExclusiveGroups }),
    ...(allSchedules !== undefined && { schedules: allSchedules }),
  };
}

async function loadMembers(groupId: number) {
  const rows = await db
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
    .where(eq(members.groupId, groupId))
    .orderBy(members.name);

  if (rows.length === 0) return [];

  const memberIds = rows.map((r) => r.id);

  const [memberRolesList, availabilityRows] = await Promise.all([
    db
      .select()
      .from(memberRoles)
      .where(inArray(memberRoles.memberId, memberIds)),
    db
      .select({
        memberId: memberAvailability.memberId,
        weekdayId: memberAvailability.weekdayId,
        startTimeUtc: memberAvailability.startTimeUtc,
        endTimeUtc: memberAvailability.endTimeUtc,
      })
      .from(memberAvailability)
      .where(inArray(memberAvailability.memberId, memberIds)),
  ]);

  const rolesByMemberId = new Map<number, { roleId: number }[]>();
  for (const r of memberRolesList) {
    const list = rolesByMemberId.get(r.memberId) ?? [];
    list.push({ roleId: r.roleId });
    rolesByMemberId.set(r.memberId, list);
  }

  const availabilityByMemberId = new Map<
    number,
    { weekdayId: number; startTimeUtc: string | null; endTimeUtc: string | null }[]
  >();
  for (const a of availabilityRows) {
    const list = availabilityByMemberId.get(a.memberId) ?? [];
    list.push({
      weekdayId: a.weekdayId,
      startTimeUtc: a.startTimeUtc,
      endTimeUtc: a.endTimeUtc,
    });
    availabilityByMemberId.set(a.memberId, list);
  }

  return rows.map((member) => {
    const memberRolesForMember = rolesByMemberId.get(member.id) ?? [];
    const availability = availabilityByMemberId.get(member.id) ?? [];
    return {
      id: member.id,
      name: member.name,
      memberEmail: member.memberEmail,
      userId: member.userId,
      groupId: member.groupId,
      email: member.userEmail,
      image: member.userImage,
      userName: member.userName,
      roleIds: memberRolesForMember.map((r) => r.roleId),
      availability: availability.map((a) => ({
        weekdayId: a.weekdayId,
        startTimeUtc: a.startTimeUtc ?? "00:00",
        endTimeUtc: a.endTimeUtc ?? "23:59",
      })),
      availableDayIds: [...new Set(availability.map((a) => a.weekdayId))],
    };
  });
}
