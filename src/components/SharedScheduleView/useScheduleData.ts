import { useMemo, useCallback } from "react";
import { getWeekdayName } from "@/lib/timezone-utils";
import {
  type ScheduleDateInfo,
  type SharedScheduleData,
  groupDatesByWeek,
  groupScheduleDatesByWeek,
} from "./types";
import { getDateDisplayLabel as getDateDisplayLabelPure } from "./helpers";

const WEEKDAY_ORDER = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

interface UseScheduleDataParams {
  schedule: SharedScheduleData;
  filteredMemberId: number | null;
  filteredRoleId: number | null;
  dayFilter: string;
  showPastDates: boolean;
  today: string;
  currentTime: number;
  t: (key: string) => string;
}

export function useScheduleData({
  schedule,
  filteredMemberId,
  filteredRoleId,
  dayFilter,
  showPastDates,
  today,
  currentTime,
  t,
}: UseScheduleDataParams) {
  // --- Stable: depend only on the schedule prop ---

  const dependentRoleIdSet = useMemo(() => {
    const ids =
      schedule.dependentRoleIds ??
      (schedule.leaderRoleId ? [schedule.leaderRoleId] : []);
    return new Set(ids);
  }, [schedule.dependentRoleIds, schedule.leaderRoleId]);

  const relevantRoleIdSet = useMemo(
    () =>
      new Set(
        (schedule.roles ?? []).filter((r) => r.isRelevant).map((r) => r.id),
      ),
    [schedule.roles],
  );

  const entryDates = useMemo(
    () => [...new Set(schedule.entries.map((e) => e.date))],
    [schedule.entries],
  );

  const scheduleDateList = useMemo(
    () => schedule.scheduleDates ?? [],
    [schedule.scheduleDates],
  );

  const scheduleDateByDateMap = useMemo(() => {
    const map = new Map<string, ScheduleDateInfo>();
    for (const sd of scheduleDateList) {
      if (!map.has(sd.date)) map.set(sd.date, sd);
    }
    return map;
  }, [scheduleDateList]);

  const roleOrder = useMemo<{ id: number; name: string }[]>(() => {
    if (schedule.roles) {
      return [...schedule.roles]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((r) => ({ id: r.id, name: r.name }));
    }
    const order: { id: number; name: string }[] = [];
    for (const entry of schedule.entries) {
      if (!order.find((r) => r.id === entry.roleId)) {
        order.push({ id: entry.roleId, name: entry.roleName });
      }
    }
    return order;
  }, [schedule.roles, schedule.entries]);

  const noteMap = useMemo(
    () => new Map(schedule.notes.map((n) => [n.date, n.description])),
    [schedule.notes],
  );

  const noteMapByScheduleDateId = useMemo(
    () =>
      new Map(
        schedule.notes
          .filter(
            (n) =>
              (n as { scheduleDateId?: number }).scheduleDateId != null,
          )
          .map((n) => [
            (n as { scheduleDateId: number }).scheduleDateId,
            n.description,
          ]),
      ),
    [schedule.notes],
  );

  const forEveryoneSet = useMemo(
    () =>
      new Set(
        schedule.scheduleDates
          ? scheduleDateList
              .filter(
                (sd) => String(sd.type).toLowerCase() === "for_everyone",
              )
              .map((sd) => sd.date)
          : schedule.forEveryoneDates ?? [],
      ),
    [schedule.scheduleDates, scheduleDateList, schedule.forEveryoneDates],
  );

  const conflictSet = useMemo(
    () =>
      new Set(
        (schedule.holidayConflicts ?? []).map(
          (c) => `${c.date}-${c.memberId}`,
        ),
      ),
    [schedule.holidayConflicts],
  );

  const allScheduleDates = useMemo(
    () =>
      scheduleDateList.length > 0
        ? [...scheduleDateList.map((sd) => sd.date)].sort()
        : [
            ...new Set([
              ...entryDates,
              ...(schedule.forEveryoneDates ?? []),
              ...(schedule.extraDates ?? []).map((d) => d.date),
            ]),
          ].sort(),
    [
      scheduleDateList,
      entryDates,
      schedule.forEveryoneDates,
      schedule.extraDates,
    ],
  );

  const availableWeekdays = useMemo(
    () =>
      [...new Set(allScheduleDates.map(getWeekdayName))].sort(
        (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
      ),
    [allScheduleDates],
  );

  // --- Filter-dependent ---

  const filteredEntries = useMemo(
    () =>
      schedule.entries.filter((entry) => {
        if (filteredMemberId && entry.memberId !== filteredMemberId)
          return false;
        if (filteredRoleId && entry.roleId !== filteredRoleId) return false;
        return true;
      }),
    [schedule.entries, filteredMemberId, filteredRoleId],
  );

  const hasActiveFilter = !!filteredMemberId || !!filteredRoleId;

  const selectedMember = useMemo(
    () => schedule.members.find((m) => m.id === filteredMemberId),
    [schedule.members, filteredMemberId],
  );

  // --- Visibility + filter dependent ---

  const visibleScheduleDates = useMemo(() => {
    if (
      scheduleDateList.length === 0 ||
      scheduleDateList.every((sd) => sd.id == null)
    )
      return [];
    const now = currentTime;
    const list = scheduleDateList.filter((sd) => {
      if (!showPastDates && today && sd.date < today) return false;
      if (dayFilter && getWeekdayName(sd.date) !== dayFilter) return false;
      if (showPastDates) return true;
      const endUtc = sd.endTimeUtc ?? sd.recurringEventEndTimeUtc ?? "23:59";
      const [h, m] = endUtc.split(":").map(Number);
      const endMs = new Date(
        `${sd.date}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00.000Z`,
      ).getTime();
      return endMs >= now;
    });
    return [...list].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return (a.startTimeUtc ?? "00:00").localeCompare(
        b.startTimeUtc ?? "00:00",
      );
    });
  }, [scheduleDateList, showPastDates, dayFilter, today, currentTime]);

  const allDates = useMemo(() => {
    if (scheduleDateList.length > 0) {
      return [...new Set(visibleScheduleDates.map((sd) => sd.date))].sort();
    }
    return [
      ...new Set([
        ...entryDates,
        ...(schedule.forEveryoneDates ?? []),
        ...(schedule.extraDates ?? []).map((d) => d.date),
      ]),
    ]
      .sort()
      .filter((d) => {
        if (!showPastDates && today && d < today) return false;
        if (dayFilter && getWeekdayName(d) !== dayFilter) return false;
        return true;
      });
  }, [
    scheduleDateList,
    visibleScheduleDates,
    entryDates,
    schedule.forEveryoneDates,
    schedule.extraDates,
    showPastDates,
    today,
    dayFilter,
  ]);

  const filteredDates = useMemo(() => {
    if (!hasActiveFilter) return allDates;
    return [...new Set(filteredEntries.map((e) => e.date))]
      .sort()
      .filter((d) => {
        if (!showPastDates && today && d < today) return false;
        if (dayFilter && getWeekdayName(d) !== dayFilter) return false;
        return true;
      });
  }, [hasActiveFilter, filteredEntries, allDates, showPastDates, today, dayFilter]);

  const filteredScheduleDates = useMemo(() => {
    if (visibleScheduleDates.length === 0) return [];
    if (!hasActiveFilter) return visibleScheduleDates;
    return visibleScheduleDates.filter((sd) =>
      filteredEntries.some(
        (e) =>
          e.date === sd.date &&
          (e.scheduleDateId == null || e.scheduleDateId === sd.id),
      ),
    );
  }, [visibleScheduleDates, hasActiveFilter, filteredEntries]);

  const assignedDateCount = useMemo(
    () =>
      filteredMemberId
        ? filteredDates.filter((d) => !forEveryoneSet.has(d)).length
        : 0,
    [filteredMemberId, filteredDates, forEveryoneSet],
  );

  const upcomingDate = useMemo(
    () =>
      filteredMemberId && today
        ? (filteredDates.find(
            (d) => d >= today && !forEveryoneSet.has(d),
          ) ?? null)
        : null,
    [filteredMemberId, today, filteredDates, forEveryoneSet],
  );

  const displayDates = useMemo(
    () =>
      upcomingDate
        ? filteredDates.filter((d) => d !== upcomingDate)
        : filteredDates,
    [upcomingDate, filteredDates],
  );

  const displayScheduleDates = useMemo(
    () =>
      upcomingDate
        ? filteredScheduleDates.filter((sd) => sd.date !== upcomingDate)
        : filteredScheduleDates,
    [upcomingDate, filteredScheduleDates],
  );

  const tableDates = useMemo(
    () => (filteredRoleId ? filteredDates : allDates),
    [filteredRoleId, filteredDates, allDates],
  );

  // --- By-week groupings ---

  const displayDatesByWeek = useMemo(
    () => groupDatesByWeek(displayDates),
    [displayDates],
  );

  const tableDatesByWeek = useMemo(
    () => groupDatesByWeek(tableDates),
    [tableDates],
  );

  const displayScheduleDatesByWeek = useMemo(
    () => groupScheduleDatesByWeek(displayScheduleDates),
    [displayScheduleDates],
  );

  const tableScheduleDatesByWeek = useMemo(
    () => groupScheduleDatesByWeek(filteredScheduleDates),
    [filteredScheduleDates],
  );

  const useScheduleDateRows = visibleScheduleDates.length > 0;

  // --- Precomputed Sets for child component props ---

  const entryDateSet = useMemo(() => new Set(entryDates), [entryDates]);
  const filteredDateSet = useMemo(
    () => new Set(filteredDates),
    [filteredDates],
  );

  // --- Memoized callbacks ---

  const getDateDisplayLabel = useCallback(
    (sd: ScheduleDateInfo) => getDateDisplayLabelPure(sd, t),
    [t],
  );

  const getNoteForScheduleDate = useCallback(
    (sd: ScheduleDateInfo): string | undefined =>
      (sd.id != null ? noteMapByScheduleDateId.get(sd.id) : undefined) ??
      noteMap.get(sd.date),
    [noteMap, noteMapByScheduleDateId],
  );

  const hasConflict = useCallback(
    (date: string, memberId: number) =>
      conflictSet.has(`${date}-${memberId}`),
    [conflictSet],
  );

  const isPast = useCallback(
    (date: string): boolean => (today ? date < today : false),
    [today],
  );

  const hasDependentRoleOnDate = useCallback(
    (date: string): boolean => {
      if (!filteredMemberId || dependentRoleIdSet.size === 0) return false;
      return filteredEntries.some(
        (e) => e.date === date && dependentRoleIdSet.has(e.roleId),
      );
    },
    [filteredMemberId, filteredEntries, dependentRoleIdSet],
  );

  const hasRelevantRoleOnDate = useCallback(
    (date: string): boolean => {
      if (!filteredMemberId || relevantRoleIdSet.size === 0) return false;
      return filteredEntries.some(
        (e) => e.date === date && relevantRoleIdSet.has(e.roleId),
      );
    },
    [filteredMemberId, filteredEntries, relevantRoleIdSet],
  );

  const getDependentRoleNamesOnDate = useCallback(
    (date: string): string[] => {
      if (!filteredMemberId) return [];
      return filteredEntries
        .filter(
          (e) => e.date === date && dependentRoleIdSet.has(e.roleId),
        )
        .map((e) => e.roleName);
    },
    [filteredMemberId, filteredEntries, dependentRoleIdSet],
  );

  const getNonDependentRolesForDate = useCallback(
    (date: string): string => {
      const dateEntries = filteredEntries.filter(
        (e) => e.date === date && !dependentRoleIdSet.has(e.roleId),
      );
      return dateEntries.map((e) => e.roleName).join(", ");
    },
    [filteredEntries, dependentRoleIdSet],
  );

  const getEntriesForScheduleDate = useCallback(
    (sd: ScheduleDateInfo) =>
      filteredEntries.filter(
        (e) =>
          e.date === sd.date &&
          (e.scheduleDateId == null || e.scheduleDateId === sd.id),
      ),
    [filteredEntries],
  );

  return {
    dependentRoleIdSet,
    relevantRoleIdSet,
    entryDateSet,
    scheduleDateList,
    scheduleDateByDateMap,
    roleOrder,
    forEveryoneSet,
    availableWeekdays,
    filteredEntries,
    hasActiveFilter,
    selectedMember,
    visibleScheduleDates,
    allDates,
    filteredDates,
    filteredDateSet,
    filteredScheduleDates,
    assignedDateCount,
    upcomingDate,
    displayDates,
    displayScheduleDates,
    tableDates,
    displayDatesByWeek,
    tableDatesByWeek,
    displayScheduleDatesByWeek,
    tableScheduleDatesByWeek,
    useScheduleDateRows,
    getDateDisplayLabel,
    getNoteForScheduleDate,
    hasConflict,
    isPast,
    hasDependentRoleOnDate,
    hasRelevantRoleOnDate,
    getDependentRoleNamesOnDate,
    getNonDependentRolesForDate,
    getEntriesForScheduleDate,
  };
}
