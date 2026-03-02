"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import { DAY_ORDER } from "@/lib/constants";
import { utcTimeToLocalDisplay, localTimeToUtc } from "@/lib/timezone-utils";

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
}: {
  roles: Role[];
  orderedRoleIds: number[];
  onOrderChange: (ids: number[]) => void;
  onApply: () => void;
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
        Reordena los roles usando las flechas. El rol superior se llena primero.
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
        Aplicar orden
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

  const [dayOfWeek, setDayOfWeek] = useState(initialEvent?.dayOfWeek ?? "");
  const [active, setActive] = useState(initialEvent?.active ?? true);
  const [type, setType] = useState<string>(initialEvent?.type ?? "assignable");
  const [label, setLabel] = useState(initialEvent?.label ?? "Evento");
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
        label.trim() !== "Evento" ||
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
      (label ?? "Evento").trim() !== (initialEvent.label ?? "Evento").trim() ||
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
        setFormError(data.error || "Error al eliminar el evento");
        setShowDeleteDialog(false);
        setAffectedInfo(null);
        return;
      }
      setDirty(false);
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
        setFormError("No se pudo comprobar el uso del evento.");
        return;
      }
      const data: AffectedInfo = await res.json();
      if (data.count === 0) {
        if (window.confirm("¿Eliminar este evento?")) {
          await performDelete(false);
        }
        return;
      }
      setAffectedInfo(data);
      setShowDeleteDialog(true);
    } catch {
      setFormError("Error de conexión.");
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
        setFormError(data.error || "Error al recalcular asignaciones");
        return;
      }
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
      setFormError("Selecciona un día de la semana.");
      return;
    }
    if (!isNew && !dayOfWeek && initialEvent) {
      setFormError("Selecciona un día de la semana.");
      return;
    }
    if (!label.trim()) {
      setFormError("La etiqueta es obligatoria.");
      return;
    }

    if (!isNew && initialEvent && active === false && initialEvent.active === true) {
      try {
        const res = await fetch(
          `/api/configuration/days/${initialEvent.id}/affected-schedule-dates?groupId=${groupId}`
        );
        if (res.ok) {
          const data: AffectedInfo = await res.json();
          if (data.count > 0 && !window.confirm(
            `Al desactivar se quitarán ${data.count} fecha(s) de los cronogramas. ¿Continuar?`
          )) {
            return;
          }
        }
      } catch {
        setFormError("No se pudo comprobar las fechas afectadas.");
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
            label: label.trim() || "Evento",
            notes: (notes ?? "").trim() || null,
            startTimeUtc: localTimeToUtc(startTimeUtc || "00:00"),
            endTimeUtc: localTimeToUtc(endTimeUtc || "23:59"),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          setFormError(data.error || "Error al crear el evento");
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
            label: label.trim() || "Evento",
            notes: (notes ?? "").trim() || null,
            startTimeUtc: localTimeToUtc(startTimeUtc || "00:00"),
            endTimeUtc: localTimeToUtc(endTimeUtc || "23:59"),
          }),
        });
        if (!putRes.ok) {
          const data = await putRes.json();
          setFormError(data.error || "Error al guardar");
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
          {isNew ? "Agregar evento" : "Editar evento"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {isNew
            ? "Crea un evento recurrente y configura su tipo y prioridades."
            : "Modifica el tipo, etiqueta y prioridades de roles para este día."}
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Etiqueta
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Ensayo, Servicio"
              required
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Obligatorio. Se muestra en el cronograma para identificar el evento.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional. Notas internas sobre este evento."
              rows={3}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground resize-y min-h-[80px]"
            />
          </div>

          {isNew ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Día de la semana
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                required
              >
                <option value="">Seleccionar día</option>
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
                Día de la semana
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
              Incluir en el cronograma
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "assignable" | "for_everyone")
              }
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="assignable">Asignación por roles</option>
              <option value="for_everyone">Para todos</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Hora inicio
              </label>
              <input
                type="time"
                value={startTimeUtc}
                onChange={(e) => setStartTimeUtc(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {type === "assignable"
                  ? "Solo se asignan personas disponibles en este horario."
                  : "Horario mostrado en el cronograma."}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Hora fin
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
                Prioridad de roles
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                El rol superior se llena primero en las fechas de este evento.
              </p>
              {editingPriorities ? (
                <>
                  <PriorityEditor
                    roles={roles}
                    orderedRoleIds={priorityOrder.length > 0 ? priorityOrder : defaultOrder}
                    onOrderChange={setPriorityOrder}
                    onApply={handleApplyPriorities}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingPriorities(false)}
                    className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
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
                    Editar orden
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
              {saving ? "Guardando…" : isNew ? "Crear evento" : "Guardar cambios"}
            </button>
            <Link
              href={`/${slug}/config/events`}
              onClick={(e) => {
                if (dirty && !window.confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) {
                  e.preventDefault();
                }
              }}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>

      {!isNew && initialEvent && groupId && (
        <section className="border-t border-border pt-8">
          <h2 className="text-lg font-medium text-foreground mb-2">Zona de riesgo</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Eliminar este evento es permanente. Si el evento ya aparece en cronogramas, puedes elegir si quitar también esas fechas.
          </p>
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={saving || deleteInProgress}
            className="rounded-md border border-destructive/50 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            Eliminar evento
          </button>
        </section>
      )}

      {showDeleteDialog && affectedInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 id="delete-dialog-title" className="text-lg font-medium text-foreground">
              Este evento ya aparece en cronogramas
            </h2>
            <p className="text-sm text-muted-foreground">
              El evento está en {affectedInfo.count} fecha(s) en {affectedInfo.schedules.length} cronograma(s).
              ¿Qué deseas hacer?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={deleteInProgress}
                onClick={() => handleDeleteConfirm(false)}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Solo eliminar evento (mantener las fechas en los cronogramas)
              </button>
              <button
                type="button"
                disabled={deleteInProgress}
                onClick={() => handleDeleteConfirm(true)}
                className="rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Eliminar evento y quitar esas fechas de los cronogramas
              </button>
              <button
                type="button"
                disabled={deleteInProgress}
                onClick={() => { setShowDeleteDialog(false); setAffectedInfo(null); }}
                className="rounded-md text-sm text-muted-foreground hover:text-foreground pt-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecalcDialog && affectedInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recalc-dialog-title"
        >
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 id="recalc-dialog-title" className="text-lg font-medium text-foreground">
              Recalcular asignaciones
            </h2>
            <p className="text-sm text-muted-foreground">
              Este evento está en {affectedInfo.count} fecha(s) en {affectedInfo.schedules.length} cronograma(s).
              ¿Quieres que se recalculen las asignaciones con el nuevo horario o día?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={recalcInProgress}
                onClick={() => handleRecalcConfirm(true)}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Sí, recalcular asignaciones
              </button>
              <button
                type="button"
                disabled={recalcInProgress}
                onClick={() => handleRecalcConfirm(false)}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                No, solo guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
