"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import { DAY_ORDER } from "@/lib/constants";
import { utcTimeToLocalDisplay, localTimeToUtc } from "@/lib/timezone-utils";
import * as Dialog from "@radix-ui/react-dialog";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Role {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
  exclusiveGroupId: number | null;
}

interface EventData {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
  active: boolean;
  type: string;
  label: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  groupId: number;
  notes?: string | null;
}

interface PriorityItem {
  roleId: number;
  priority: number;
  roleName: string;
}

function PriorityEditor({
  roles,
  orderedRoleIds,
  onOrderChange,
  onApply,
  reorderHelp,
  applyOrderLabel,
}: {
  roles: Role[];
  orderedRoleIds: number[];
  onOrderChange: (ids: number[]) => void;
  onApply: () => void;
  reorderHelp: string;
  applyOrderLabel: string;
}) {
  const orderedRoles = useMemo(() => {
    const byId = new Map(roles.map((r) => [r.id, r]));
    return orderedRoleIds.map((id) => byId.get(id)).filter(Boolean) as Role[];
  }, [roles, orderedRoleIds]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...orderedRoleIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onOrderChange(next);
  };

  const moveDown = (index: number) => {
    if (index === orderedRoleIds.length - 1) return;
    const next = [...orderedRoleIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onOrderChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">
        {reorderHelp}
      </p>
      {orderedRoles.map((role, index) => (
        <div
          key={role.id}
          className="flex items-center gap-2 border-b border-border px-3.5 py-2 text-sm last:border-b-0"
        >
          <span className="text-muted-foreground w-6 text-right text-xs">
            {index + 1}.
          </span>
          <span className="flex-1">{role.name}</span>
          <button
            type="button"
            onClick={() => moveUp(index)}
            disabled={index === 0}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveDown(index)}
            disabled={index === orderedRoles.length - 1}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            ↓
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onApply}
        className="mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {applyOrderLabel}
      </button>
    </div>
  );
}

export interface EventFormProps {
  slug: string;
  groupId: number | null;
  isNew: boolean;
  initialEvent: EventData | null;
  roles: Role[];
  initialPriorities: PriorityItem[];
}

export default function EventForm({
  slug,
  groupId,
  isNew,
  initialEvent,
  roles,
  initialPriorities,
}: EventFormProps) {
  const router = useRouter();
  const { setDirty } = useUnsavedConfig();
  const { refetchContext } = useGroup();
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const tConfigNav = useTranslations("configNav");

  const [dayOfWeek, setDayOfWeek] = useState(initialEvent?.dayOfWeek ?? "");
  const [active, setActive] = useState(initialEvent?.active ?? true);
  const [type, setType] = useState<string>(initialEvent?.type ?? "assignable");
  const [label, setLabel] = useState(initialEvent?.label ?? t("eventDefaultLabel"));
  const [notes, setNotes] = useState(initialEvent?.notes ?? "");
  const [startTimeUtc, setStartTimeUtc] = useState(
    initialEvent ? utcTimeToLocalDisplay(initialEvent.startTimeUtc ?? "00:00") : "00:00"
  );
  const [endTimeUtc, setEndTimeUtc] = useState(
    initialEvent ? utcTimeToLocalDisplay(initialEvent.endTimeUtc ?? "23:59") : "23:59"
  );

  const [priorityOrder, setPriorityOrder] = useState<number[]>(() => {
    const sorted = [...initialPriorities].sort((a, b) => a.priority - b.priority);
    return sorted.map((p) => p.roleId);
  });
  const [editingPriorities, setEditingPriorities] = useState(false);
  const [appliedPriorityOrder, setAppliedPriorityOrder] = useState<number[]>(() => {
    const sorted = [...initialPriorities].sort((a, b) => a.priority - b.priority);
    return sorted.map((p) => p.roleId);
  });

  const isForEveryone = String(type).toLowerCase() === "for_everyone";

  const dirty = useMemo(() => {
    const initialStartLocal = initialEvent ? utcTimeToLocalDisplay(initialEvent.startTimeUtc ?? "00:00") : "00:00";
    const initialEndLocal = initialEvent ? utcTimeToLocalDisplay(initialEvent.endTimeUtc ?? "23:59") : "23:59";
    if (isNew) {
      return (
        dayOfWeek !== "" ||
        active !== true ||
        type !== "assignable" ||
        label.trim() !== t("eventDefaultLabel") ||
        (notes ?? "").trim() !== "" ||
        startTimeUtc !== "00:00" ||
        endTimeUtc !== "23:59" ||
        JSON.stringify(priorityOrder) !== JSON.stringify(appliedPriorityOrder)
      );
    }
    if (!initialEvent) return false;
    return (
      dayOfWeek !== (initialEvent.dayOfWeek ?? "") ||
      active !== initialEvent.active ||
      type !== initialEvent.type ||
      (label ?? t("eventDefaultLabel")).trim() !== (initialEvent.label ?? t("eventDefaultLabel")).trim() ||
      (notes ?? "").trim() !== (initialEvent.notes ?? "").trim() ||
      startTimeUtc !== initialStartLocal ||
      endTimeUtc !== initialEndLocal ||
      JSON.stringify(priorityOrder) !== JSON.stringify(appliedPriorityOrder)
    );
  }, [
    isNew,
    initialEvent,
    dayOfWeek,
    active,
    type,
    label,
    startTimeUtc,
    endTimeUtc,
    priorityOrder,
    appliedPriorityOrder,
    notes,
    t,
  ]);

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (type === "for_everyone") setActive(true);
  }, [type]);

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  type AffectedInfo = { count: number; schedules: { scheduleId: number; month: number; year: number; dateCount: number }[] };
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSimpleDeleteConfirm, setShowSimpleDeleteConfirm] = useState(false);
  const [affectedInfo, setAffectedInfo] = useState<AffectedInfo | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [showRecalcDialog, setShowRecalcDialog] = useState(false);
  const [recalcInProgress, setRecalcInProgress] = useState(false);

  const handleApplyPriorities = () => {
    setAppliedPriorityOrder(priorityOrder);
    setEditingPriorities(false);
  };

  const performDelete = async (removeScheduleDates: boolean) => {
    if (!groupId || !initialEvent) return;
    setDeleteInProgress(true);
    try {
      const res = await fetch(
        `/api/configuration/days/${initialEvent.id}?groupId=${groupId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ removeScheduleDates }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorDelete"));
        setShowDeleteDialog(false);
        setAffectedInfo(null);
        return;
      }
      setDirty(false);
      await refetchContext();
      router.push(`/${slug}/config/events`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!groupId || !initialEvent) return;
    setFormError("");
    try {
      const res = await fetch(
        `/api/configuration/days/${initialEvent.id}/affected-schedule-dates?groupId=${groupId}`
      );
      if (!res.ok) {
        setFormError(t("errorCheckAffected"));
        return;
      }
      const data: AffectedInfo = await res.json();
      if (data.count === 0) {
        setShowSimpleDeleteConfirm(true);
        return;
      }
      setAffectedInfo(data);
      setShowDeleteDialog(true);
    } catch {
      setFormError(t("errorConnection"));
    }
  };

  const handleDeleteConfirm = (removeScheduleDates: boolean) => {
    performDelete(removeScheduleDates);
    setShowDeleteDialog(false);
    setAffectedInfo(null);
  };

  const handleRecalcConfirm = async (doRecalc: boolean) => {
    setShowRecalcDialog(false);
    if (!doRecalc || !groupId || !initialEvent) {
      await refetchContext();
      router.push(`/${slug}/config/events`);
      return;
    }
    setRecalcInProgress(true);
    try {
      const res = await fetch(
        `/api/configuration/days/${initialEvent.id}/recalculate-assignments?groupId=${groupId}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorRecalc"));
        return;
      }
      await refetchContext();
      router.push(`/${slug}/config/events`);
    } finally {
      setRecalcInProgress(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!groupId) return;
    if (isNew && !dayOfWeek) {
      setFormError(t("errorSelectDay"));
      return;
    }
    if (!isNew && !dayOfWeek && initialEvent) {
      setFormError(t("errorSelectDay"));
      return;
    }
    if (!label.trim()) {
      setFormError(t("errorLabelRequired"));
      return;
    }

    if (!isNew && initialEvent && active === false && initialEvent.active === true) {
      try {
        const res = await fetch(
          `/api/configuration/days/${initialEvent.id}/affected-schedule-dates?groupId=${groupId}`
        );
        if (res.ok) {
          const data: AffectedInfo = await res.json();
          if (data.count > 0 && !window.confirm(t("confirmDeactivate", { n: data.count }))) {
            return;
          }
        }
      } catch {
        setFormError(t("errorCheckDates"));
        return;
      }
    }

    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch(`/api/configuration/days?groupId=${groupId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayOfWeek,
            active,
            type: type === "for_everyone" ? "for_everyone" : "assignable",
            label: label.trim() || t("eventDefaultLabel"),
            notes: (notes ?? "").trim() || null,
            startTimeUtc: localTimeToUtc(startTimeUtc || "00:00"),
            endTimeUtc: localTimeToUtc(endTimeUtc || "23:59"),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error || t("errorCreate"));
          return;
        }
        const created = await res.json();
        if (type === "assignable") {
          const orderToSave = appliedPriorityOrder.length > 0 ? appliedPriorityOrder : defaultOrder;
          if (orderToSave.length > 0) {
            const priorities = orderToSave.map((roleId, i) => ({
              roleId,
              priority: i,
            }));
            await fetch(`/api/configuration/priorities?groupId=${groupId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recurringEventId: created.id,
                priorities,
              }),
            });
          }
        }
        setDirty(false);
        await refetchContext();
        router.push(`/${slug}/config/events/${created.id}`);
      } else if (initialEvent) {
        const putRes = await fetch(`/api/configuration/days?groupId=${groupId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: initialEvent.id,
            dayOfWeek: dayOfWeek || initialEvent.dayOfWeek,
            active,
            type: type === "for_everyone" ? "for_everyone" : "assignable",
            label: label.trim() || t("eventDefaultLabel"),
            notes: (notes ?? "").trim() || null,
            startTimeUtc: localTimeToUtc(startTimeUtc || "00:00"),
            endTimeUtc: localTimeToUtc(endTimeUtc || "23:59"),
          }),
        });
        if (!putRes.ok) {
          const data = await putRes.json();
          setFormError(data.error || t("errorSave"));
          return;
        }
        if (type === "assignable") {
          const priorities = appliedPriorityOrder.map((roleId, i) => ({
            roleId,
            priority: i,
          }));
          await fetch(`/api/configuration/priorities?groupId=${groupId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recurringEventId: initialEvent.id,
              priorities,
            }),
          });
        }
        setDirty(false);

        const dayOrTimeChanged =
          type === "assignable" &&
          (dayOfWeek !== (initialEvent.dayOfWeek ?? "") ||
            startTimeUtc !== utcTimeToLocalDisplay(initialEvent.startTimeUtc ?? "00:00") ||
            endTimeUtc !== utcTimeToLocalDisplay(initialEvent.endTimeUtc ?? "23:59"));

        if (dayOrTimeChanged) {
          try {
            const affRes = await fetch(
              `/api/configuration/days/${initialEvent.id}/affected-schedule-dates?groupId=${groupId}`
            );
            if (affRes.ok) {
              const affData: AffectedInfo = await affRes.json();
              if (affData.count > 0) {
                setAffectedInfo(affData);
                setShowRecalcDialog(true);
                return;
              }
            }
          } catch {
            // ignore; redirect anyway
          }
        }
        await refetchContext();
        router.push(`/${slug}/config/events`);
      }
    } finally {
      setSaving(false);
    }
  };

  const assignableRoleIds = roles.filter((r) => r.dependsOnRoleId == null).map((r) => r.id);
  const defaultOrder = useMemo(() => {
    const current = new Set(appliedPriorityOrder);
    const rest = assignableRoleIds.filter((id) => !current.has(id));
    return [...appliedPriorityOrder, ...rest];
  }, [assignableRoleIds, appliedPriorityOrder]);

  useEffect(() => {
    if (priorityOrder.length === 0 && assignableRoleIds.length > 0 && !editingPriorities) {
      setPriorityOrder(defaultOrder);
    }
  }, [defaultOrder, assignableRoleIds.length, editingPriorities, priorityOrder.length]);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          {isNew ? t("addEventTitle") : t("editEventTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {isNew
            ? t("addEventSubtitle")
            : t("editEventSubtitle")}
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("labelLabel")}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              required
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("labelHelp")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("notesLabel")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={3}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground resize-y min-h-[80px]"
            />
          </div>

          {isNew ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("dayOfWeek")}
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                required
              >
                <option value="">{t("selectDay")}</option>
                {DAY_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("dayOfWeek")}
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
              >
                {DAY_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="event-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={isForEveryone}
              className="rounded border-border w-4 h-4"
            />
            <label htmlFor="event-active" className="text-sm cursor-pointer select-none">
              {t("includeInSchedule")}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("typeLabel")}
            </label>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "assignable" | "for_everyone")
              }
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="assignable">{t("typeAssignable")}</option>
              <option value="for_everyone">{t("typeForEveryone")}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("startTime")}
              </label>
              <input
                type="time"
                value={startTimeUtc}
                onChange={(e) => setStartTimeUtc(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {type === "assignable"
                  ? t("startTimeHelpAssignable")
                  : t("startTimeHelpOther")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("endTime")}
              </label>
              <input
                type="time"
                value={endTimeUtc}
                onChange={(e) => setEndTimeUtc(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
              />
            </div>
          </div>

          {type === "assignable" && roles.length > 0 && (
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-medium text-foreground mb-2">
                {t("rolePriority")}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t("rolePriorityHelp")}
              </p>
              {editingPriorities ? (
                <>
                  <PriorityEditor
                    roles={roles}
                    orderedRoleIds={priorityOrder.length > 0 ? priorityOrder : defaultOrder}
                    onOrderChange={setPriorityOrder}
                    onApply={handleApplyPriorities}
                    reorderHelp={t("reorderHelp")}
                    applyOrderLabel={t("applyOrder")}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingPriorities(false)}
                    className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {tCommon("cancel")}
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(priorityOrder.length > 0 ? priorityOrder : defaultOrder).map(
                      (roleId, i) => {
                        const role = roles.find((r) => r.id === roleId);
                        return role ? (
                          <span
                            key={role.id}
                            className="rounded-full border border-border px-3 py-1 text-xs"
                          >
                            {i + 1}. {role.name}
                          </span>
                        ) : null;
                      }
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPriorities(true)}
                    className="text-sm text-accent hover:opacity-80 transition-opacity"
                  >
                    {t("editOrder")}
                  </button>
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? t("saving") : isNew ? t("createEvent") : t("saveChanges")}
            </button>
            <Link
              href={`/${slug}/config/events`}
              onClick={(e) => {
                if (dirty && !window.confirm(tConfigNav("unsavedConfirm"))) {
                  e.preventDefault();
                }
              }}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              {tCommon("cancel")}
            </Link>
          </div>
        </form>
      </section>

      {!isNew && initialEvent && groupId && (
        <DangerZone description={t("dangerZoneHelp")}>
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={saving || deleteInProgress}
            className="rounded-md border border-destructive/50 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            {t("deleteEvent")}
          </button>
        </DangerZone>
      )}

      <ConfirmDialog
        open={showSimpleDeleteConfirm}
        onOpenChange={setShowSimpleDeleteConfirm}
        title={t("deleteEventTitle")}
        message={t("confirmDelete")}
        confirmLabel={tCommon("delete")}
        onConfirm={() => performDelete(false)}
        loading={deleteInProgress}
      />

      {showDeleteDialog && affectedInfo && (
        <Dialog.Root open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setAffectedInfo(null); } }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-description"
              onEscapeKeyDown={() => { setShowDeleteDialog(false); setAffectedInfo(null); }}
            >
              <Dialog.Title id="delete-dialog-title" className="text-lg font-medium text-foreground">
                {t("deleteDialogTitle")}
              </Dialog.Title>
              <p id="delete-dialog-description" className="mt-2 text-sm text-muted-foreground">
                {t("deleteDialogMessage", {
                  count: affectedInfo.count,
                  schedules: affectedInfo.schedules.length,
                })}
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="button"
                  disabled={deleteInProgress}
                  onClick={() => handleDeleteConfirm(false)}
                  className="rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {t("deleteEventOnly")}
                </button>
                <button
                  type="button"
                  disabled={deleteInProgress}
                  onClick={() => handleDeleteConfirm(true)}
                  className="rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {t("deleteEventAndDates")}
                </button>
                <button
                  type="button"
                  disabled={deleteInProgress}
                  onClick={() => { setShowDeleteDialog(false); setAffectedInfo(null); }}
                  className="rounded-md text-sm text-muted-foreground hover:text-foreground pt-2"
                >
                  {tCommon("cancel")}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {showRecalcDialog && affectedInfo && (
        <Dialog.Root open={showRecalcDialog} onOpenChange={(open) => { if (!open) setShowRecalcDialog(false); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background p-6 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              aria-labelledby="recalc-dialog-title"
              aria-describedby="recalc-dialog-description"
              onEscapeKeyDown={() => setShowRecalcDialog(false)}
            >
              <Dialog.Title id="recalc-dialog-title" className="text-lg font-medium text-foreground">
                {t("recalcDialogTitle")}
              </Dialog.Title>
              <p id="recalc-dialog-description" className="mt-2 text-sm text-muted-foreground">
                {t("recalcDialogMessage", {
                  count: affectedInfo.count,
                  schedules: affectedInfo.schedules.length,
                })}
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="button"
                  disabled={recalcInProgress}
                  onClick={() => handleRecalcConfirm(true)}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t("recalcYes")}
                </button>
                <button
                  type="button"
                  disabled={recalcInProgress}
                  onClick={() => handleRecalcConfirm(false)}
                  className="rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {t("recalcNo")}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
