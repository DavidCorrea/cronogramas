"use client";

import { useEffect, useState, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import {
  formatDateWeekdayDay,
  formatDateRange,
  utcTimeToLocalDisplay,
  localTimeToUtc,
} from "@/lib/timezone-utils";
import { getEligibleMemberIds } from "@/lib/schedule-model";
import BackLink from "@/components/BackLink";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TogglePill } from "@/components/TogglePill";
import type {
  ScheduleDateInfo,
  RoleInfo,
  ScheduleDetail,
  Member,
  ScheduleDay,
  ScheduleDetailClientProps,
} from "./schedule-detail-types";
import { getWeekDateRange, slotKey } from "./schedule-detail-helpers";
import { RebuildModal } from "./RebuildModal";
import { EditDateModal } from "./EditDateModal";
import { AuditLogSection } from "./AuditLogSection";

export default function ScheduleDetailClient({
  slug,
  scheduleId,
  initialSchedule,
  initialMembers,
  initialScheduleDays,
}: ScheduleDetailClientProps) {
  const router = useRouter();
  const t = useTranslations("scheduleDetail");
  const tCommon = useTranslations("common");
  const tSchedules = useTranslations("schedules");
  const monthNames = getRawArray(tSchedules, "months");
  const [schedule, setSchedule] = useState<ScheduleDetail>(initialSchedule);
  const [members] = useState<Member[]>(initialMembers);
  const [scheduleDays] = useState<ScheduleDay[]>(initialScheduleDays);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteScheduleOpen, setConfirmDeleteScheduleOpen] = useState(false);
  const [deleteScheduleInProgress, setDeleteScheduleInProgress] = useState(false);

  const [, startFilterTransition] = useTransition();
  const [showPastDates, setShowPastDates] = useState(false);

  const setShowPastDatesTransition = useCallback(
    (v: boolean) => startFilterTransition(() => setShowPastDates(v)),
    [startFilterTransition],
  );

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

  const [extraDateValue, setExtraDateValue] = useState("");
  const [extraDateType, setExtraDateType] = useState<"assignable" | "for_everyone">("assignable");
  const [extraDateLabel, setExtraDateLabel] = useState("Ensayo");
  const [showAddDate, setShowAddDate] = useState(false);

  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuildMode, setRebuildMode] = useState<"overwrite" | "fill_empty" | null>(null);
  const [rebuildPreview, setRebuildPreview] = useState<{ date: string; roleId: number; roleName: string; memberId: number; memberName: string }[] | null>(null);
  const [rebuildRemovedCount, setRebuildRemovedCount] = useState(0);
  const [rebuildLoading, setRebuildLoading] = useState(false);

  const [editDateModal, setEditDateModal] = useState<ScheduleDateInfo | null>(null);
  const [confirmDeleteDateOpen, setConfirmDeleteDateOpen] = useState(false);
  const [editDateStartUtc, setEditDateStartUtc] = useState("00:00");
  const [editDateEndUtc, setEditDateEndUtc] = useState("23:59");
  const [editDateNote, setEditDateNote] = useState("");
  const [editDateSaving, setEditDateSaving] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logDetailOpen, setLogDetailOpen] = useState<number | null>(null);

  const [editState, setEditState] = useState<Map<string, number | null>>(
    new Map()
  );
  const [initialState, setInitialState] = useState<Map<string, number | null>>(
    new Map()
  );

  const fetchData = useCallback(async () => {
    const scheduleRes = await fetch(`/api/schedules/${scheduleId}`);

    if (!scheduleRes.ok) {
      router.push(`/${slug}/config/schedules`);
      return;
    }

    const scheduleData: ScheduleDetail = await scheduleRes.json();
    setSchedule(scheduleData);
  }, [scheduleId, router, slug]);

  const roleOrder = useMemo(() => {
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

  const forEveryoneSet = useMemo(
    () =>
      new Set(
        schedule.scheduleDates
          .filter((d) => String(d.type).toLowerCase() === "for_everyone")
          .map((d) => d.id)
      ),
    [schedule]
  );
  const conflictSet = useMemo(
    () =>
      new Set(
        (schedule.holidayConflicts ?? []).map((c) => `${c.date}-${c.memberId}`)
      ),
    [schedule]
  );
  const noteMap = useMemo(
    () =>
      new Map(
        schedule.scheduleDates
          .filter((sd) => sd.note != null && sd.note.trim() !== "")
          .map((sd) => [sd.id, sd.note!])
      ),
    [schedule]
  );
  const visibleScheduleDates = useMemo(() => {
    const list = [...schedule.scheduleDates];
    list.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.startTimeUtc ?? "00:00").localeCompare(b.startTimeUtc ?? "00:00");
    });
    return list;
  }, [schedule]);

  const weekdayIdToDayName = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of scheduleDays) {
      map.set(d.weekdayId, d.dayOfWeek);
    }
    return map;
  }, [scheduleDays]);

  const membersWithDayNames = useMemo(
    () =>
      members.map((m) => ({
        id: m.id,
        roleIds: m.roleIds,
        availableDays: m.availableDayIds
          .map((id) => weekdayIdToDayName.get(id))
          .filter((n): n is string => n != null),
      })),
    [members, weekdayIdToDayName]
  );

  useEffect(() => {
    if (roleOrder.length === 0) return;

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

  const getDateDisplayLabel = (sd: ScheduleDateInfo): string => {
    return sd.recurringEventLabel ?? sd.label ?? (sd.type === "for_everyone" ? "Ensayo" : "Evento");
  };

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

    await fetch(`/api/schedules/${scheduleId}`, {
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

    const res = await fetch(`/api/schedules/${scheduleId}`, {
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
    const res = await fetch(`/api/schedules/${scheduleId}`, {
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
    const res = await fetch(`/api/schedules/${scheduleId}`, {
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
    const res = await fetch(`/api/schedules/${scheduleId}`, {
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
    const res = await fetch(`/api/schedules/${scheduleId}`, {
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
    const res = await fetch(`/api/schedules/${scheduleId}`, {
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
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/${slug}/config/schedules`);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error ?? tSchedules("errorGenerate"));
      }
    } finally {
      setDeleteScheduleInProgress(false);
    }
  };

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  const hasFutureDates = visibleScheduleDates.some((sd) => sd.date >= todayISO);
  const hasPastDates = visibleScheduleDates.some((sd) => sd.date < todayISO);
  const visibleScheduleDatesFiltered = useMemo(() => {
    if (showPastDates) return visibleScheduleDates;
    return visibleScheduleDates.filter((sd) => sd.date >= todayISO);
  }, [visibleScheduleDates, showPastDates, todayISO]);

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

  useEffect(() => {
    if (visibleScheduleDatesByWeek.length === 0) return;
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
  }, [schedule.id, visibleScheduleDatesByWeek, todayISO]);

  const getEligibleMembers = (scheduleDateId: number, date: string, role: RoleInfo): Member[] => {
    const assignmentsOnDate: { roleId: number; memberId: number }[] = [];
    for (const r of roleOrder) {
      const slots = Math.max(
        r.requiredCount,
        schedule.entries.filter(
          (e) => e.scheduleDateId === scheduleDateId && e.roleId === r.id
        ).length
      );
      for (let i = 0; i < slots; i++) {
        const mid = editState.get(slotKey(scheduleDateId, r.id, i));
        if (mid != null) assignmentsOnDate.push({ roleId: r.id, memberId: mid });
      }
    }

    const eligibleIds = new Set(
      getEligibleMemberIds({
        role: { id: role.id, dependsOnRoleId: role.dependsOnRoleId },
        date,
        members: membersWithDayNames,
        assignmentsOnDate,
      })
    );
    return members.filter((m) => eligibleIds.has(m.id));
  };

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
            <h1 className="font-[family-name:var(--font-display)] font-semibold text-2xl sm:text-3xl uppercase">
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
          <TogglePill
            checked={showPastDates}
            onChange={setShowPastDatesTransition}
            label={t("showPastDates")}
            id="show-past-dates"
          />
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
          const isForEveryone = forEveryoneSet.has(sd.id);
          const note = noteMap.get(sd.id);
          const timeRange = sd.startTimeUtc && sd.endTimeUtc && (sd.startTimeUtc !== "00:00" || sd.endTimeUtc !== "23:59")
            ? `${utcTimeToLocalDisplay(sd.startTimeUtc)} – ${utcTimeToLocalDisplay(sd.endTimeUtc)}`
            : null;

          return (
            <div
              key={sd.id}
              className={`border border-border rounded-md overflow-hidden ${isForEveryone ? "bg-muted/30" : "bg-background"}`}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">{formatDateWeekdayDay(sd.date)}</span>
                    {timeRange && (
                      <span className="text-xs text-muted-foreground">{timeRange}</span>
                    )}
                    {!isForEveryone && getDateDisplayLabel(sd) && (
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

              {isForEveryone && (
                <div className="px-4 py-3 text-sm text-muted-foreground italic text-center border-b border-border">
                  {getDateDisplayLabel(sd) || "Ensayo"}
                </div>
              )}

              {!isForEveryone && (
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
              const isForEveryone = forEveryoneSet.has(sd.id);
              const note = noteMap.get(sd.id);
              const timeRange = sd.startTimeUtc && sd.endTimeUtc && (sd.startTimeUtc !== "00:00" || sd.endTimeUtc !== "23:59")
                ? `${utcTimeToLocalDisplay(sd.startTimeUtc)} – ${utcTimeToLocalDisplay(sd.endTimeUtc)}`
                : null;

              return (
                <tr
                  key={sd.id}
                  className={`border-b border-border ${isForEveryone ? "bg-muted/20" : "hover:bg-muted/30"} transition-colors`}
                >
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                    <div>
                      <div>{formatDateWeekdayDay(sd.date)}</div>
                      {timeRange && (
                        <div className="text-xs text-muted-foreground mt-0.5">{timeRange}</div>
                      )}
                      {!isForEveryone && getDateDisplayLabel(sd) && (
                        <div className="text-xs text-muted-foreground italic mt-0.5">
                          {getDateDisplayLabel(sd)}
                        </div>
                      )}
                    </div>
                    {note ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>
                    ) : null}
                  </td>
                  {isForEveryone ? (
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

      <AuditLogSection
        entries={schedule.auditLog ?? []}
        logOpen={logOpen}
        logDetailOpen={logDetailOpen}
        onToggleLog={() => setLogOpen(!logOpen)}
        onToggleDetail={setLogDetailOpen}
        t={t}
      />

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

      {rebuildOpen && (
        <RebuildModal
          rebuildMode={rebuildMode}
          rebuildLoading={rebuildLoading}
          rebuildPreview={rebuildPreview}
          rebuildRemovedCount={rebuildRemovedCount}
          onPreview={handleRebuildPreview}
          onApply={handleRebuildApply}
          onClose={closeRebuild}
          t={t}
          tCommon={tCommon}
        />
      )}

      {editDateModal && (
        <EditDateModal
          date={editDateModal.date}
          startUtc={editDateStartUtc}
          endUtc={editDateEndUtc}
          note={editDateNote}
          saving={editDateSaving}
          onStartChange={setEditDateStartUtc}
          onEndChange={setEditDateEndUtc}
          onNoteChange={setEditDateNote}
          onSave={handleSaveEditDate}
          onDelete={handleDeleteFromEditModal}
          onClose={closeEditDateModal}
          t={t}
          tCommon={tCommon}
        />
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
