"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import { useGroup } from "@/lib/group-context";
import {
  formatDateShort as formatDate,
  formatDateWeekdayDay,
  formatDateRange,
  getDayOfWeek,
  utcTimeToLocalDisplay,
  localTimeToUtc,
} from "@/lib/timezone-utils";
import LoadingScreen from "@/components/LoadingScreen";
import BackLink from "@/components/BackLink";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ScheduleEntry {
  id: number;
  scheduleDateId: number;
  date: string;
  roleId: number;
  memberId: number;
  memberName: string;
  roleName: string;
}

interface ScheduleDateInfo {
  id: number;
  date: string;
  type: "assignable" | "for_everyone";
  label: string | null;
  note: string | null;
  startTimeUtc: string;
  endTimeUtc: string;
  recurringEventId?: number | null;
  recurringEventLabel?: string | null;
  entries: ScheduleEntry[];
}

interface RoleInfo {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
}

interface HolidayConflict {
  date: string;
  memberId: number;
  memberName: string;
}

interface AuditLogEntry {
  id: number;
  action: string;
  detail: string | null;
  userName: string | null;
  createdAt: string;
}

interface ScheduleDetail {
  id: number;
  month: number;
  year: number;
  status: string;
  entries: ScheduleEntry[];
  scheduleDates: ScheduleDateInfo[];
  roles: RoleInfo[];
  prevScheduleId: number | null;
  nextScheduleId: number | null;
  holidayConflicts?: HolidayConflict[];
  auditLog?: AuditLogEntry[];
}

interface Member {
  id: number;
  name: string;
  roleIds: number[];
  availableDayIds: number[];
}

interface ScheduleDay {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
  active: boolean;
  type?: string;
  label?: string | null;
  groupId?: number;
}

/** Full calendar date range for a week of the month (independent of filters). Week 1 = days 1-7, week 2 = 8-14, etc. */
function getWeekDateRange(year: number, month: number, weekNumber: number): { start: string; end: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = Math.min(weekNumber * 7, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(month)}-${pad(startDay)}`,
    end: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

interface AuditDetailStructured {
  message: string;
  changes?: { date: string; role: string; from: string | null; to: string | null }[];
  added?: { date: string; roleName: string; memberName: string }[];
  mode?: string;
  removedCount?: number;
}

function tryParseJson(str: string | null): AuditDetailStructured | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null && "message" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

function formatRelativeTime(
  isoStr: string,
  t: (key: string, values?: { n?: number }) => string
): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("now");
  if (diffMin < 60) return t("minutesAgo", { n: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t("hoursAgo", { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t("yesterday");
  if (diffDays < 30) return t("daysAgo", { n: diffDays });
  return new Date(isoStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Key for the edit state map: "scheduleDateId|roleId|slotIndex"
function slotKey(scheduleDateId: number, roleId: number, slotIndex: number): string {
  return `${scheduleDateId}|${roleId}|${slotIndex}`;
}

export default function SchedulePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("scheduleDetail");
  const tCommon = useTranslations("common");
  const tSchedules = useTranslations("schedules");
  const monthNames = getRawArray(tSchedules, "months");
  const { groupId, slug, loading: groupLoading, refetchContext } = useGroup();
  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteScheduleOpen, setConfirmDeleteScheduleOpen] = useState(false);
  const [deleteScheduleInProgress, setDeleteScheduleInProgress] = useState(false);

  const [showPastDates, setShowPastDates] = useState(false);

  // Collapsed week sections (week numbers in the set are collapsed)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set());
  const initialCollapseAppliedForRef = useRef<number | null>(null);
  const toggleWeek = useCallback((weekNumber: number) => {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  }, []);

  // Add date form
  const [extraDateValue, setExtraDateValue] = useState("");
  const [extraDateType, setExtraDateType] = useState<"assignable" | "for_everyone">("assignable");
  const [extraDateLabel, setExtraDateLabel] = useState("Ensayo");
  const [showAddDate, setShowAddDate] = useState(false);

  // Rebuild flow
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuildMode, setRebuildMode] = useState<"overwrite" | "fill_empty" | null>(null);
  const [rebuildPreview, setRebuildPreview] = useState<{ date: string; roleId: number; roleName: string; memberId: number; memberName: string }[] | null>(null);
  const [rebuildRemovedCount, setRebuildRemovedCount] = useState(0);
  const [rebuildLoading, setRebuildLoading] = useState(false);

  // Edit schedule date modal (time, note, delete)
  const [editDateModal, setEditDateModal] = useState<ScheduleDateInfo | null>(null);
  const [confirmDeleteDateOpen, setConfirmDeleteDateOpen] = useState(false);
  const [editDateStartUtc, setEditDateStartUtc] = useState("00:00");
  const [editDateEndUtc, setEditDateEndUtc] = useState("23:59");
  const [editDateNote, setEditDateNote] = useState("");
  const [editDateSaving, setEditDateSaving] = useState(false);

  // Audit log
  const [logOpen, setLogOpen] = useState(false);
  const [logDetailOpen, setLogDetailOpen] = useState<number | null>(null);

  // Local editable state: slotKey -> memberId | null
  const [editState, setEditState] = useState<Map<string, number | null>>(
    new Map()
  );
  // Snapshot of the initial state from the server (to detect dirty)
  const [initialState, setInitialState] = useState<Map<string, number | null>>(
    new Map()
  );

  const fetchData = useCallback(async () => {
    if (!groupId) return;

    const [scheduleRes, membersRes, daysRes] = await Promise.all([
      fetch(`/api/schedules/${params.id}`),
      fetch(`/api/members?groupId=${groupId}`),
      fetch(`/api/configuration/days?groupId=${groupId}`),
    ]);

    if (!scheduleRes.ok) {
      router.push("/schedules");
      return;
    }

    const scheduleData: ScheduleDetail = await scheduleRes.json();
    setSchedule(scheduleData);
    setMembers(await membersRes.json());
    setScheduleDays(await daysRes.json());
    setLoading(false);
  }, [params.id, router, groupId]);

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId, fetchData]);

  // Derive roleOrder from schedule
  const roleOrder = useMemo(() => {
    if (!schedule) return [];
    const entryRoleIds = new Set(schedule.entries.map((e) => e.roleId));
    const dependentRoleIds = new Set(
      schedule.roles
        .filter((r) => r.dependsOnRoleId != null)
        .map((r) => r.id)
    );
    return schedule.roles
      .filter((r) => entryRoleIds.has(r.id) || dependentRoleIds.has(r.id))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [schedule]);

  const rehearsalSet = useMemo(
    () =>
      new Set(
        (schedule?.scheduleDates ?? [])
          .filter((d) => String(d.type).toLowerCase() === "for_everyone")
          .map((d) => d.id)
      ),
    [schedule]
  );
  const conflictSet = useMemo(
    () =>
      new Set(
        (schedule?.holidayConflicts ?? []).map((c) => `${c.date}-${c.memberId}`)
      ),
    [schedule]
  );
  const noteMap = useMemo(
    () =>
      new Map(
        (schedule?.scheduleDates ?? [])
          .filter((sd) => sd.note != null && sd.note.trim() !== "")
          .map((sd) => [sd.id, sd.note!])
      ),
    [schedule]
  );
  const visibleScheduleDates = useMemo(() => {
    if (!schedule) return [];
    const list = [...schedule.scheduleDates];
    list.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.startTimeUtc ?? "00:00").localeCompare(b.startTimeUtc ?? "00:00");
    });
    return list;
  }, [schedule]);

  // Map dayOfWeek name -> weekdayId for availability lookups (member.availableDayIds are weekday ids)
  const dayOfWeekToWeekdayId = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of scheduleDays) {
      map.set(d.dayOfWeek, d.weekdayId);
    }
    return map;
  }, [scheduleDays]);

  // Build edit state from schedule whenever schedule changes (keyed by scheduleDateId)
  useEffect(() => {
    if (!schedule || roleOrder.length === 0) return;

    const state = new Map<string, number | null>();
    const assignableSds = schedule.scheduleDates.filter(
      (sd) => String(sd.type).toLowerCase() !== "for_everyone"
    );

    for (const sd of assignableSds) {
      for (const role of roleOrder) {
        const roleEntries = schedule.entries
          .filter((e) => e.scheduleDateId === sd.id && e.roleId === role.id)
          .sort((a, b) => a.id - b.id);
        const slotCount = Math.max(role.requiredCount, roleEntries.length);
        for (let i = 0; i < slotCount; i++) {
          const key = slotKey(sd.id, role.id, i);
          state.set(key, roleEntries[i]?.memberId ?? null);
        }
      }
    }

    setEditState(new Map(state));
    setInitialState(new Map(state));
  }, [schedule, roleOrder]);

  // Helper: display label for a schedule date (recurring event label when linked, else stored label, else default)
  const getDateDisplayLabel = (sd: ScheduleDateInfo): string => {
    return sd.recurringEventLabel ?? sd.label ?? (sd.type === "for_everyone" ? "Ensayo" : "Evento");
  };

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    if (editState.size !== initialState.size) return true;
    for (const [key, value] of editState) {
      if (initialState.get(key) !== value) return true;
    }
    return false;
  }, [editState, initialState]);

  const updateSlot = (scheduleDateId: number, roleId: number, slotIndex: number, memberId: number | null) => {
    setEditState((prev) => {
      const next = new Map(prev);
      next.set(slotKey(scheduleDateId, roleId, slotIndex), memberId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!schedule) return;
    setSaving(true);

    const entries: Array<{ scheduleDateId: number; roleId: number; memberId: number | null }> = [];
    for (const [key, memberId] of editState) {
      const [scheduleDateIdStr, roleIdStr] = key.split("|");
      entries.push({
        scheduleDateId: parseInt(scheduleDateIdStr, 10),
        roleId: parseInt(roleIdStr, 10),
        memberId,
      });
    }

    await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk_update", entries }),
    });

    setSaving(false);
    fetchData();
  };

  const handleCommit = async () => {
    if (!confirm(t("confirmCreateSchedule")))
      return;

    const res = await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit" }),
    });

    if (res.ok) {
      fetchData();
    }
  };

  const handleAddExtraDate = async () => {
    if (!extraDateValue) return;
    const res = await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_date",
        date: extraDateValue,
        type: extraDateType,
        label: extraDateType === "for_everyone" ? extraDateLabel : undefined,
      }),
    });
    if (res.ok) {
      setExtraDateValue("");
      setShowAddDate(false);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || t("errorAddDate"));
    }
  };

  const openEditDateModal = (sd: ScheduleDateInfo) => {
    setEditDateModal(sd);
    setEditDateStartUtc(utcTimeToLocalDisplay(sd.startTimeUtc ?? "00:00"));
    setEditDateEndUtc(utcTimeToLocalDisplay(sd.endTimeUtc ?? "23:59"));
    setEditDateNote(sd.note ?? "");
  };

  const closeEditDateModal = () => {
    setEditDateModal(null);
  };

  const handleSaveEditDate = async () => {
    if (!editDateModal) return;
    setEditDateSaving(true);
    const res = await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_date",
        scheduleDateId: editDateModal.id,
        startTimeUtc: localTimeToUtc(editDateStartUtc),
        endTimeUtc: localTimeToUtc(editDateEndUtc),
        note: editDateNote.trim() || null,
      }),
    });
    setEditDateSaving(false);
    if (res.ok) {
      closeEditDateModal();
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || t("errorSave"));
    }
  };

  const handleDeleteFromEditModal = () => {
    setConfirmDeleteDateOpen(true);
  };

  const performDeleteDate = async () => {
    if (!editDateModal) return;
    const res = await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_date", scheduleDateId: editDateModal.id }),
    });
    if (res.ok) {
      closeEditDateModal();
      fetchData();
      setConfirmDeleteDateOpen(false);
    }
  };

  const handleRebuildPreview = async (mode: "overwrite" | "fill_empty") => {
    setRebuildMode(mode);
    setRebuildLoading(true);
    setRebuildPreview(null);
    const res = await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rebuild_preview", mode }),
    });
    const data = await res.json();
    if (res.ok) {
      setRebuildPreview(data.preview);
      setRebuildRemovedCount(data.removedCount);
    } else {
      alert(data.error || t("errorPreview"));
      setRebuildOpen(false);
    }
    setRebuildLoading(false);
  };

  const handleRebuildApply = async () => {
    if (!rebuildMode) return;
    setRebuildLoading(true);
    const res = await fetch(`/api/schedules/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rebuild_apply", mode: rebuildMode }),
    });
    setRebuildLoading(false);
    if (res.ok) {
      setRebuildOpen(false);
      setRebuildPreview(null);
      setRebuildMode(null);
      fetchData();
    }
  };

  const closeRebuild = () => {
    setRebuildOpen(false);
    setRebuildPreview(null);
    setRebuildMode(null);
  };

  const performDeleteSchedule = async () => {
    setDeleteScheduleInProgress(true);
    try {
      const res = await fetch(`/api/schedules/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        await refetchContext();
        router.push(`/${slug}/config/schedules`);
      } else {
        const data = await res.json();
        alert(data.error ?? tSchedules("errorGenerate"));
      }
    } finally {
      setDeleteScheduleInProgress(false);
    }
  };

  // Check if there are future dates for the rebuild button
  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  const hasFutureDates = visibleScheduleDates.some((sd) => sd.date >= todayISO);
  const hasPastDates = visibleScheduleDates.some((sd) => sd.date < todayISO);
  const visibleScheduleDatesFiltered = useMemo(() => {
    if (showPastDates) return visibleScheduleDates;
    return visibleScheduleDates.filter((sd) => sd.date >= todayISO);
  }, [visibleScheduleDates, showPastDates, todayISO]);

  // Group visible schedule dates by week of month (Semana 1 = days 1-7, etc.)
  const visibleScheduleDatesByWeek = useMemo(() => {
    const weekMap = new Map<number, ScheduleDateInfo[]>();
    for (const sd of visibleScheduleDatesFiltered) {
      const dayOfMonth = parseInt(sd.date.slice(8, 10), 10);
      const weekNum = Math.ceil(dayOfMonth / 7);
      if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
      weekMap.get(weekNum)!.push(sd);
    }
    return [...weekMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([weekNumber, scheduleDates]) => ({ weekNumber, scheduleDates }));
  }, [visibleScheduleDatesFiltered]);

  // Default: all weeks collapsed except the one containing today (once per schedule load)
  useEffect(() => {
    if (!schedule?.id || visibleScheduleDatesByWeek.length === 0) return;
    if (initialCollapseAppliedForRef.current === schedule.id) return;
    initialCollapseAppliedForRef.current = schedule.id;
    const weekWithToday = visibleScheduleDatesByWeek.find((w) =>
      w.scheduleDates.some((sd) => sd.date === todayISO)
    )?.weekNumber;
    const allWeekNumbers = visibleScheduleDatesByWeek.map((w) => w.weekNumber);
    const toCollapse = weekWithToday != null
      ? allWeekNumbers.filter((n) => n !== weekWithToday)
      : allWeekNumbers;
    setCollapsedWeeks(new Set(toCollapse));
  }, [schedule?.id, visibleScheduleDatesByWeek, todayISO]);

  if (groupLoading || loading || !schedule) {
    return <LoadingScreen fullPage={false} />;
  }

  // Helper: check if a member is available on a given date
  const isMemberAvailable = (member: Member, date: string): boolean => {
    if (member.availableDayIds.length === 0) return true;
    const dayName = getDayOfWeek(date);
    const weekdayId = dayOfWeekToWeekdayId.get(dayName);
    if (weekdayId == null) return true;
    return member.availableDayIds.includes(weekdayId);
  };

  // Helper: get eligible members for a role slot (for a specific schedule date / event)
  const getEligibleMembers = (scheduleDateId: number, date: string, role: RoleInfo): Member[] => {
    if (role.dependsOnRoleId != null) {
      const sourceEntryMemberIds: number[] = [];
      for (const sourceRole of roleOrder) {
        if (sourceRole.id === role.dependsOnRoleId) {
          const slotCount = Math.max(
            sourceRole.requiredCount,
            schedule.entries.filter(
              (e) => e.scheduleDateId === scheduleDateId && e.roleId === sourceRole.id
            ).length
          );
          for (let i = 0; i < slotCount; i++) {
            const mid = editState.get(slotKey(scheduleDateId, sourceRole.id, i));
            if (mid != null) sourceEntryMemberIds.push(mid);
          }
        }
      }
      return members.filter(
        (m) =>
          sourceEntryMemberIds.includes(m.id) &&
          m.roleIds.includes(role.id)
      );
    }
    return members.filter(
      (m) => m.roleIds.includes(role.id) && isMemberAvailable(m, date)
    );
  };

  // Render a single select for a slot (for a specific schedule date / event)
  const renderSlotSelect = (
    scheduleDateId: number,
    date: string,
    role: RoleInfo,
    slotIndex: number,
    totalSlots?: number
  ) => {
    const key = slotKey(scheduleDateId, role.id, slotIndex);
    const currentMemberId = editState.get(key) ?? null;
    const eligible = getEligibleMembers(scheduleDateId, date, role);

    const takenByOtherSlots = new Set<number>();
    const slots = totalSlots ?? role.requiredCount;
    for (let i = 0; i < slots; i++) {
      if (i === slotIndex) continue;
      const otherId = editState.get(slotKey(scheduleDateId, role.id, i));
      if (otherId != null) takenByOtherSlots.add(otherId);
    }

    const options = eligible.filter(
      (m) => !takenByOtherSlots.has(m.id) || m.id === currentMemberId
    );

    const showConflict =
      currentMemberId != null && conflictSet.has(`${date}-${currentMemberId}`);

    return (
      <div key={key} className="w-full">
        <select
          className={`rounded-md border bg-transparent px-3 py-2 text-sm w-full ${
            showConflict
              ? "border-amber-500"
              : "border-border"
          }`}
          value={currentMemberId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            updateSlot(scheduleDateId, role.id, slotIndex, val ? parseInt(val, 10) : null);
          }}
        >
          <option value="">{t("emptySlot")}</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {showConflict && (
          <p className="text-xs text-amber-500 mt-0.5">{t("onHoliday")}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <BackLink href={`/${slug}/config/schedules`} label={t("backToScheduleList")} />
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            {schedule.prevScheduleId && (
              <a
                href={`/${slug}/config/schedules/${schedule.prevScheduleId}`}
                className="rounded-md border border-border px-3 py-2 text-sm hover:border-foreground transition-colors"
              >
                {t("previous")}
              </a>
            )}
            <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl uppercase">
              {monthNames[schedule.month - 1]} {schedule.year}
            </h1>
            {schedule.nextScheduleId && (
              <a
                href={`/${slug}/config/schedules/${schedule.nextScheduleId}`}
                className="rounded-md border border-border px-3 py-2 text-sm hover:border-foreground transition-colors"
              >
                {t("next")}
              </a>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {hasFutureDates && (
              <button
                onClick={() => setRebuildOpen(true)}
                disabled={isDirty}
                className="flex-1 sm:flex-none rounded-md border border-border px-4 py-2.5 text-sm hover:border-foreground transition-colors disabled:opacity-50"
                title={isDirty ? t("rebuildTitleSaveFirst") : t("rebuildTitle")}
              >
                {t("rebuild")}
              </button>
            )}
            {schedule.status === "draft" && (
              <button
                onClick={handleCommit}
                disabled={isDirty}
                className="flex-1 sm:flex-none rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                title={isDirty ? t("rebuildTitleSaveFirst") : undefined}
              >
                {t("createSchedule")}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {schedule.status === "committed" ? (
            <>
              {t("scheduleCreated")}{" "}
              <a
                href={`/${slug}/cronograma/${schedule.year}/${schedule.month}`}
                className="text-accent hover:opacity-80 transition-opacity"
              >
                {t("viewSharedLink")}
              </a>
            </>
          ) : (
            t("draftNote")
          )}
        </p>
      </div>

      {/* Add extra date + past dates toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowAddDate(!showAddDate)}
          className="text-sm text-accent hover:opacity-80 transition-opacity"
        >
          {showAddDate ? tCommon("cancel") : t("addDate")}
        </button>
        {hasPastDates && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPastDates}
              onChange={(e) => setShowPastDates(e.target.checked)}
              className="rounded border-border"
            />
            {t("showPastDates")}
          </label>
        )}
      </div>
      {showAddDate && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border border-border rounded-md p-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("dateLabel")}</label>
              <input
                type="date"
                value={extraDateValue}
                onChange={(e) => setExtraDateValue(e.target.value)}
                min={`${schedule.year}-${String(schedule.month).padStart(2, "0")}-01`}
                max={`${schedule.year}-${String(schedule.month).padStart(2, "0")}-${new Date(Date.UTC(schedule.year, schedule.month, 0)).getUTCDate()}`}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("typeLabel")}</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setExtraDateType("assignable")}
                  className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                    extraDateType === "assignable"
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t("typeAssignable")}
                </button>
                <button
                  onClick={() => setExtraDateType("for_everyone")}
                  className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                    extraDateType === "for_everyone"
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t("typeForEveryone")}
                </button>
              </div>
            </div>
            {extraDateType === "for_everyone" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("labelLabel")}</label>
                <input
                  type="text"
                  value={extraDateLabel}
                  onChange={(e) => setExtraDateLabel(e.target.value)}
                  placeholder={t("labelPlaceholder")}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-40"
                />
              </div>
            )}
            <button
              onClick={handleAddExtraDate}
              disabled={!extraDateValue}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {tCommon("add")}
            </button>
          </div>
        )}

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky top-0 z-20 bg-background border-b border-border py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("unsavedChanges")}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
          >
            {saving ? t("saving") : t("saveChanges")}
          </button>
        </div>
      )}

      {/* Mobile card view */}
      <div className="md:hidden space-y-8">
        {visibleScheduleDatesByWeek.map(({ weekNumber, scheduleDates }) => {
          const isCollapsed = collapsedWeeks.has(weekNumber);
          return (
          <section
            key={weekNumber}
            className="border border-border rounded-lg bg-muted/10 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleWeek(weekNumber)}
              className="w-full px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
              aria-expanded={!isCollapsed}
            >
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("week")} {weekNumber}
                <span className="normal-case font-normal tracking-normal text-muted-foreground/90">
                  {" · "}
                  {formatDateRange(
                    getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
                    getWeekDateRange(schedule.year, schedule.month, weekNumber).end
                  )}
                </span>
              </h2>
              <span className="text-muted-foreground shrink-0" aria-hidden>
                {isCollapsed ? "▶" : "▼"}
              </span>
            </button>
            {!isCollapsed && (
            <div className="p-4 space-y-4">
        {scheduleDates.map((sd) => {
          const isRehearsal = rehearsalSet.has(sd.id);
          const note = noteMap.get(sd.id);
          const timeRange = sd.startTimeUtc && sd.endTimeUtc && (sd.startTimeUtc !== "00:00" || sd.endTimeUtc !== "23:59")
            ? `${utcTimeToLocalDisplay(sd.startTimeUtc)} – ${utcTimeToLocalDisplay(sd.endTimeUtc)}`
            : null;

          return (
            <div
              key={sd.id}
              className={`border border-border rounded-md overflow-hidden ${isRehearsal ? "bg-muted/30" : "bg-background"}`}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{formatDateWeekdayDay(sd.date)}</span>
                    {timeRange && (
                      <span className="text-xs text-muted-foreground">{timeRange}</span>
                    )}
                    {!isRehearsal && getDateDisplayLabel(sd) && (
                      <span className="text-xs text-muted-foreground italic">
                        {getDateDisplayLabel(sd)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {note ? (
                      <span className="text-xs text-muted-foreground">{note}</span>
                    ) : null}
                    <button
                      onClick={() => openEditDateModal(sd)}
                      className="text-xs text-accent hover:opacity-80"
                      title={t("editEvent")}
                    >
                      {tCommon("edit")}
                    </button>
                  </div>
                </div>
              </div>

              {isRehearsal && (
                <div className="px-4 py-3 text-sm text-muted-foreground italic text-center border-b border-border">
                  {getDateDisplayLabel(sd) || "Ensayo"}
                </div>
              )}

              {!isRehearsal && (
                <div className="divide-y divide-border/50">
                  {roleOrder.map((role) => {
                    const existingEntries = schedule.entries.filter(
                      (e) => e.scheduleDateId === sd.id && e.roleId === role.id
                    );
                    const slotCount = Math.max(role.requiredCount, existingEntries.length);

                    return (
                      <div key={role.id} className="px-4 py-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">
                          {role.name}
                        </div>
                        <div className={slotCount > 1 ? "grid grid-cols-2 gap-2" : ""}>
                          {Array.from({ length: slotCount }).map((_, i) =>
                            renderSlotSelect(sd.id, sd.date, role, i, slotCount)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
            })}
            </div>
            )}
          </section>
          );
        })}
      </div>

      {/* Desktop table view: one table per week */}
      <div className="hidden md:block space-y-8">
        {visibleScheduleDatesByWeek.map(({ weekNumber, scheduleDates }) => {
          const isCollapsed = collapsedWeeks.has(weekNumber);
          return (
          <section key={weekNumber} className="border border-border rounded-lg overflow-hidden bg-muted/5">
            <button
              type="button"
              onClick={() => toggleWeek(weekNumber)}
              className="w-full px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 text-left hover:bg-muted/30 transition-colors"
              aria-expanded={!isCollapsed}
            >
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {t("week")} {weekNumber}
                <span className="normal-case font-normal tracking-normal text-muted-foreground/90">
                  {" · "}
                  {formatDateRange(
                    getWeekDateRange(schedule.year, schedule.month, weekNumber).start,
                    getWeekDateRange(schedule.year, schedule.month, weekNumber).end
                  )}
                </span>
              </h2>
              <span className="text-muted-foreground shrink-0" aria-hidden>
                {isCollapsed ? "▶" : "▼"}
              </span>
            </button>
            {!isCollapsed && (
            <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("dateLabel")}
              </th>
              {roleOrder.map((role) => (
                <th
                  key={role.id}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground"
                >
                  {role.name}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {scheduleDates.map((sd) => {
              const isRehearsal = rehearsalSet.has(sd.id);
              const note = noteMap.get(sd.id);
              const timeRange = sd.startTimeUtc && sd.endTimeUtc && (sd.startTimeUtc !== "00:00" || sd.endTimeUtc !== "23:59")
                ? `${utcTimeToLocalDisplay(sd.startTimeUtc)} – ${utcTimeToLocalDisplay(sd.endTimeUtc)}`
                : null;

              return (
                <tr
                  key={sd.id}
                  className={`border-b border-border ${isRehearsal ? "bg-muted/20" : "hover:bg-muted/30"} transition-colors`}
                >
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                    <div>
                      <div>{formatDateWeekdayDay(sd.date)}</div>
                      {timeRange && (
                        <div className="text-xs text-muted-foreground mt-0.5">{timeRange}</div>
                      )}
                      {!isRehearsal && getDateDisplayLabel(sd) && (
                        <div className="text-xs text-muted-foreground italic mt-0.5">
                          {getDateDisplayLabel(sd)}
                        </div>
                      )}
                    </div>
                    {note ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>
                    ) : null}
                  </td>
                  {isRehearsal ? (
                    <td
                      colSpan={roleOrder.length}
                      className="px-4 py-3 text-sm text-muted-foreground italic text-center"
                    >
                      {getDateDisplayLabel(sd) || "Ensayo"}
                    </td>
                  ) : (
                    roleOrder.map((role) => {
                      const existingEntries = schedule.entries.filter(
                        (e) => e.scheduleDateId === sd.id && e.roleId === role.id
                      );
                      const slotCount = Math.max(role.requiredCount, existingEntries.length);

                      return (
                        <td key={role.id} className="px-4 py-3 text-sm">
                          <div className={slotCount > 1 ? "grid grid-cols-2 gap-1.5" : ""}>
                            {Array.from({ length: slotCount }).map((_, i) =>
                              renderSlotSelect(sd.id, sd.date, role, i, slotCount)
                            )}
                          </div>
                        </td>
                      );
                    })
                  )}
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => openEditDateModal(sd)}
                      className="text-xs text-accent hover:opacity-80"
                      title={t("editEvent")}
                    >
                      {tCommon("edit")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
            </div>
            )}
          </section>
          );
        })}
      </div>

      {/* Audit log */}
      {schedule.auditLog && schedule.auditLog.length > 0 && (
        <div className="border border-border rounded-md">
          <button
            onClick={() => setLogOpen(!logOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{t("changeHistory")} ({schedule.auditLog.length})</span>
            <span className="text-xs">{logOpen ? "▲" : "▼"}</span>
          </button>
          {logOpen && (
            <div className="border-t border-border divide-y divide-border">
              {schedule.auditLog.map((entry) => {
                const parsed = tryParseJson(entry.detail);
                const isStructured = parsed && (parsed.changes || parsed.added);

                return (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {isStructured ? parsed.message : (entry.detail ?? entry.action)}
                        </p>
                        {entry.userName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("byUser", { name: entry.userName })}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatRelativeTime(entry.createdAt, t)}
                      </span>
                    </div>
                    {isStructured && (
                      <div className="mt-1">
                        <button
                          onClick={() => setLogDetailOpen(logDetailOpen === entry.id ? null : entry.id)}
                          className="text-xs text-accent hover:opacity-80 transition-opacity"
                        >
                          {logDetailOpen === entry.id ? t("hideDetails") : t("showDetails")}
                        </button>
                        {logDetailOpen === entry.id && (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {parsed.changes?.map((c, i) => (
                              <div key={`${c.date}-${c.role ?? ""}-${c.from ?? ""}-${c.to ?? ""}-${i}`} className="flex gap-2">
                                <span className="shrink-0">{c.date}</span>
                                <span className="shrink-0 uppercase tracking-wide">{c.role}</span>
                                <span>
                                  {c.from ?? "—"} → {c.to ?? "—"}
                                </span>
                              </div>
                            ))}
                            {parsed.added && (
                              <>
                                {(parsed.removedCount ?? 0) > 0 && (
                                  <p>{parsed.removedCount} asignacion{parsed.removedCount === 1 ? "" : "es"} reemplazada{parsed.removedCount === 1 ? "" : "s"}</p>
                                )}
                                {parsed.added.map((a, i) => (
                                  <div key={`${a.date}-${a.roleName}-${a.memberName}-${i}`} className="flex gap-2">
                                    <span className="shrink-0">{a.date}</span>
                                    <span className="shrink-0 uppercase tracking-wide">{a.roleName}</span>
                                    <span>{a.memberName}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {!schedule.auditLog?.length && (
        <div className="text-sm text-muted-foreground text-center py-4">
          {t("noChangesRecorded")}
        </div>
      )}

      <DangerZone description={tSchedules("dangerZoneDescription")}>
        <button
          type="button"
          onClick={() => setConfirmDeleteScheduleOpen(true)}
          disabled={deleteScheduleInProgress}
          className="rounded-md border border-destructive px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          {tCommon("delete")}
        </button>
      </DangerZone>

      {/* Rebuild modal */}
      {rebuildOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-[family-name:var(--font-display)] text-lg uppercase">
                {t("rebuildModalTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("rebuildModalSubtitle")}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!rebuildMode && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleRebuildPreview("overwrite")}
                    className="w-full rounded-md border border-border p-4 text-left hover:border-foreground transition-colors"
                  >
                    <p className="text-sm font-medium">{t("rebuildOverwrite")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("rebuildOverwriteHelp")}
                    </p>
                  </button>
                  <button
                    onClick={() => handleRebuildPreview("fill_empty")}
                    className="w-full rounded-md border border-border p-4 text-left hover:border-foreground transition-colors"
                  >
                    <p className="text-sm font-medium">{t("rebuildFillEmpty")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("rebuildFillEmptyHelp")}
                    </p>
                  </button>
                </div>
              )}

              {rebuildLoading && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("generatingPreview")}
                </p>
              )}

              {rebuildPreview && !rebuildLoading && (
                <div className="space-y-4">
                  {rebuildRemovedCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("willReplaceAssignments", { n: rebuildRemovedCount })}
                    </p>
                  )}
                  {rebuildPreview.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t("noNewAssignments")}
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {(() => {
                        const grouped = new Map<string, typeof rebuildPreview>();
                        for (const entry of rebuildPreview!) {
                          const list = grouped.get(entry.date) ?? [];
                          list.push(entry);
                          grouped.set(entry.date, list);
                        }
                        return [...grouped.entries()].map(([date, entries]) => (
                          <div key={date} className="py-3 first:pt-0">
                            <p className="text-sm font-medium mb-1.5">{formatDate(date)}</p>
                            <div className="space-y-1">
                              {entries.map((e) => (
                                <div key={`${e.date}-${e.roleId}-${e.memberId}`} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground text-xs uppercase tracking-wide">{e.roleName}</span>
                                  <span>{e.memberName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={closeRebuild}
                className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
              >
                {tCommon("cancel")}
              </button>
              {rebuildPreview && rebuildPreview.length > 0 && (
                <button
                  onClick={handleRebuildApply}
                  disabled={rebuildLoading}
                  className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {rebuildLoading ? t("applying") : t("apply")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit schedule date modal */}
      {editDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-[family-name:var(--font-display)] text-lg uppercase">
                {t("editDateTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateWeekdayDay(editDateModal.date)}
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t("startTimeLabel")}</label>
                  <input
                    type="time"
                    value={editDateStartUtc}
                    onChange={(e) => setEditDateStartUtc(e.target.value)}
                    className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">{t("yourTimezone")}</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t("endTimeLabel")}</label>
                  <input
                    type="time"
                    value={editDateEndUtc}
                    onChange={(e) => setEditDateEndUtc(e.target.value)}
                    className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">{t("yourTimezone")}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("noteLabel")}</label>
                <input
                  type="text"
                  value={editDateNote}
                  onChange={(e) => setEditDateNote(e.target.value)}
                  placeholder={tCommon("optional")}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm w-full"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleDeleteFromEditModal}
                className="text-sm text-destructive hover:opacity-80"
              >
                {t("deleteDate")}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={closeEditDateModal}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleSaveEditDate}
                  disabled={editDateSaving}
                  className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {editDateSaving ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteDateOpen}
        onOpenChange={setConfirmDeleteDateOpen}
        title={t("deleteDate")}
        message={t("confirmDeleteDate")}
        confirmLabel={tCommon("delete")}
        onConfirm={performDeleteDate}
      />
      <ConfirmDialog
        open={confirmDeleteScheduleOpen}
        onOpenChange={setConfirmDeleteScheduleOpen}
        title={tSchedules("deleteScheduleTitle")}
        message={tSchedules("confirmDelete")}
        confirmLabel={tCommon("delete")}
        onConfirm={performDeleteSchedule}
        loading={deleteScheduleInProgress}
      />
    </div>
  );
}
