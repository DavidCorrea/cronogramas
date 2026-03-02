"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useGroup } from "@/lib/group-context";
import { buildColumnOrderPayload } from "@/lib/column-order";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import LoadingScreen from "@/components/LoadingScreen";

interface Role {
  id: number;
  name: string;
  displayOrder: number;
}

function ColumnOrderEditor({
  orderedRoles,
  onOrderChange,
}: {
  orderedRoles: Role[];
  onOrderChange: (roles: Role[]) => void;
}) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedRoles];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    onOrderChange(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === orderedRoles.length - 1) return;
    const newOrder = [...orderedRoles];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    onOrderChange(newOrder);
  };

  return (
    <div className="space-y-2">
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {orderedRoles.map((role, index) => (
          <OrderChip
            key={role.id}
            role={role}
            index={index}
            total={orderedRoles.length}
            onMoveLeft={() => moveUp(index)}
            onMoveRight={() => moveDown(index)}
          />
        ))}
      </div>

      <div className="md:hidden overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {orderedRoles.map((role, index) => (
              <OrderRow
                key={role.id}
                role={role}
                index={index}
                total={orderedRoles.length}
                onMoveUp={() => moveUp(index)}
                onMoveDown={() => moveDown(index)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderChip({
  role,
  index,
  total,
  onMoveLeft,
  onMoveRight,
}: {
  role: Role;
  index: number;
  total: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/30 shrink-0">
      <button
        type="button"
        onClick={onMoveLeft}
        disabled={index === 0}
        aria-label="Mover a la izquierda"
        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        ←
      </button>
      <span className="font-medium min-w-0 truncate max-w-[8rem]">
        {role.name}
      </span>
      <button
        type="button"
        onClick={onMoveRight}
        disabled={index === total - 1}
        aria-label="Mover a la derecha"
        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        →
      </button>
    </div>
  );
}

function OrderRow({
  role,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  role: Role;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors text-sm">
      <td className="px-4 py-3 font-medium">
        {role.name}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Subir"
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Bajar"
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            ↓
          </button>
        </div>
      </td>
    </tr>
  );
}

interface Schedule {
  id: number;
  month: number;
  year: number;
  status: string;

  createdAt: string;
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function getNextAvailableMonth(
  schedulesList: { month: number; year: number }[],
  afterMonth?: number,
  afterYear?: number
): { month: number; year: number } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const set = new Set(
    schedulesList.map((s) => `${s.year}-${s.month}`)
  );
  let m: number;
  let y: number;
  if (afterMonth != null && afterYear != null) {
    m = afterMonth === 12 ? 1 : afterMonth + 1;
    y = afterMonth === 12 ? afterYear + 1 : afterYear;
  } else {
    m = currentMonth;
    y = currentYear;
  }
  // Skip past months
  while (y < currentYear || (y === currentYear && m < currentMonth)) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  // Skip months that already have a schedule
  while (set.has(`${y}-${m}`)) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { month: m, year: y };
}

export default function SchedulesPage() {
  const { groupId, slug, loading: groupLoading } = useGroup();
  const { setDirty } = useUnsavedConfig();
  const [schedulesList, setSchedulesList] = useState<Schedule[]>([]);
  const [, setRoles] = useState<Role[]>([]);
  const [orderedRoles, setOrderedRoles] = useState<Role[]>([]);
  const [initialOrder, setInitialOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generation form: start with no selection; set to next available after fetch
  const [selectedMonths, setSelectedMonths] = useState<
    { month: number; year: number }[]
  >([]);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const [schedulesRes, rolesRes] = await Promise.all([
      fetch(`/api/schedules?groupId=${groupId}`),
      fetch(`/api/configuration/roles?groupId=${groupId}`),
    ]);
    const schedulesListData = await schedulesRes.json();
    setSchedulesList(schedulesListData);
    const rolesData = await rolesRes.json();
    setRoles(rolesData);
    const sorted = [...rolesData].sort(
      (a: Role, b: Role) => a.displayOrder - b.displayOrder
    );
    setOrderedRoles(sorted);
    setInitialOrder(sorted.map((r: Role) => r.id));
    setSelectedMonths((prev) =>
      prev.length === 0 ? [getNextAvailableMonth(schedulesListData)] : prev
    );
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId, fetchData]);

  const orderDirty = useMemo(
    () =>
      orderedRoles.length !== initialOrder.length ||
      orderedRoles.some((r, i) => r.id !== initialOrder[i]),
    [orderedRoles, initialOrder]
  );

  useEffect(() => {
    setDirty(orderDirty);
  }, [orderDirty, setDirty]);

  useEffect(() => {
    if (!orderDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [orderDirty]);

  const handleSaveOrder = async () => {
    if (!groupId) return;
    await fetch(`/api/configuration/roles?groupId=${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: buildColumnOrderPayload(orderedRoles) }),
    });
    setInitialOrder(orderedRoles.map((r) => r.id));
    setDirty(false);
  };

  const existingScheduleKeys = useMemo(
    () => new Set(schedulesList.map((s) => `${s.year}-${s.month}`)),
    [schedulesList]
  );

  const updateMonth = (field: "month" | "year", value: number) => {
    if (selectedMonths.length === 0) return;
    const updated = [{ ...selectedMonths[0], [field]: value }];
    setSelectedMonths(updated);
  };

  const handleGenerate = async () => {
    if (selectedMonths.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/schedules?groupId=${groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: selectedMonths }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error al generar cronograma");
        return;
      }

      fetchData();
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este cronograma?")) return;
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (groupLoading || loading) {
    return <LoadingScreen message="Cargando..." fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">Cronogramas</h1>
        <p className="mt-3 text-muted-foreground">
          Genera nuevos cronogramas o consulta los existentes.
        </p>
      </div>

      <div className="border-t border-border pt-8">
        {/* Generate form */}
        <div>
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">Generar cronograma</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Selecciona un mes para generar el cronograma.
          </p>

          {selectedMonths.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <select
                value={selectedMonths[0].month}
                onChange={(e) =>
                  updateMonth("month", parseInt(e.target.value, 10))
                }
                className="flex-1 sm:flex-none rounded-md border border-border bg-transparent px-3 py-2.5 text-sm min-h-[40px]"
              >
                {MONTH_NAMES.map((name, i) => {
                  const monthNum = i + 1;
                  const now = new Date();
                  const currentMonth = now.getMonth() + 1;
                  const currentYear = now.getFullYear();
                  const sm = selectedMonths[0];
                  const isPast =
                    sm.year < currentYear ||
                    (sm.year === currentYear && monthNum < currentMonth);
                  const alreadyCreated = existingScheduleKeys.has(
                    `${sm.year}-${monthNum}`
                  );
                  if (isPast && monthNum !== sm.month) return null;
                  if (alreadyCreated && monthNum !== sm.month) return null;
                  return (
                    <option key={i} value={monthNum}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <input
                type="number"
                value={selectedMonths[0].year}
                onChange={(e) =>
                  updateMonth("year", parseInt(e.target.value, 10))
                }
                className="w-24 rounded-md border border-border bg-transparent px-3 py-2.5 text-sm min-h-[40px]"
                min={new Date().getFullYear()}
                max={2040}
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generating ? "Generando..." : "Generar"}
              </button>
            </div>
          )}
        </div>

        {/* Schedules list */}
        <div className="border-t border-border pt-8 mt-8">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">Cronogramas existentes</h2>
          {schedulesList.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Aún no se han generado cronogramas.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...schedulesList]
                .sort((a, b) => b.year - a.year || b.month - a.month)
                .map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {MONTH_NAMES[schedule.month - 1]} {schedule.year}
                      </span>
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${
                          schedule.status === "committed"
                            ? "border-success/40 text-success"
                            : "border-amber-400/40 text-amber-600"
                        }`}
                      >
                        {schedule.status === "committed"
                          ? "Visible"
                          : schedule.status === "draft"
                            ? "Borrador"
                            : schedule.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/${slug}/config/schedules/${schedule.id}`}
                        className="flex-1 min-w-0 text-center rounded-md border border-border px-3.5 py-2 text-sm hover:border-foreground transition-colors"
                      >
                        Editar
                      </Link>
                      {schedule.status === "committed" && (
                        <Link
                          href={`/${slug}/cronograma/${schedule.year}/${schedule.month}`}
                          className="flex-1 min-w-0 text-center rounded-md border border-foreground px-3.5 py-2 text-sm font-medium hover:bg-foreground hover:text-background transition-colors"
                        >
                          Ver
                        </Link>
                      )}
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="flex-1 min-w-0 rounded-md border border-border px-3.5 py-2 text-sm text-destructive hover:border-destructive transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orden de columnas */}
      <div className="border-t border-border pt-8">
        <section className="space-y-4">
          <div>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
              Orden de columnas
            </h2>
            <p className="text-sm text-muted-foreground">
              Configura el orden de visualización de las columnas de roles en todas las vistas de cronogramas.
            </p>
          </div>
          <ColumnOrderEditor
            orderedRoles={orderedRoles}
            onOrderChange={setOrderedRoles}
          />
          {orderDirty && (
            <button
              type="button"
              onClick={handleSaveOrder}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Guardar orden
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
