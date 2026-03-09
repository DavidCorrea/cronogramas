"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import { buildColumnOrderPayload } from "@/lib/column-order";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import { EmptyState } from "@/components/EmptyState";

interface Role {
  id: number;
  name: string;
  displayOrder: number;
}

function ColumnOrderEditor({
  orderedRoles,
  onOrderChange,
  moveLeftLabel,
  moveRightLabel,
  moveUpLabel,
  moveDownLabel,
}: {
  orderedRoles: Role[];
  onOrderChange: (roles: Role[]) => void;
  moveLeftLabel: string;
  moveRightLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
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
            moveLeftLabel={moveLeftLabel}
            moveRightLabel={moveRightLabel}
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
                moveUpLabel={moveUpLabel}
                moveDownLabel={moveDownLabel}
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
  moveLeftLabel,
  moveRightLabel,
}: {
  role: Role;
  index: number;
  total: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  moveLeftLabel: string;
  moveRightLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/30 shrink-0">
      <button
        type="button"
        onClick={onMoveLeft}
        disabled={index === 0}
        aria-label={moveLeftLabel}
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
        aria-label={moveRightLabel}
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
  moveUpLabel,
  moveDownLabel,
}: {
  role: Role;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
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
            aria-label={moveUpLabel}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={moveDownLabel}
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
  createdAt?: string;
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
  const existingMonthKeys = new Set(
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
  while (y < currentYear || (y === currentYear && m < currentMonth)) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  while (existingMonthKeys.has(`${y}-${m}`)) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { month: m, year: y };
}

interface SchedulesPageClientProps {
  slug: string;
  groupId: number;
  initialSchedules: Schedule[];
  roles: Role[];
}

export default function SchedulesPageClient({
  slug,
  groupId,
  initialSchedules,
  roles,
}: SchedulesPageClientProps) {
  const router = useRouter();
  const t = useTranslations("schedules");
  const monthNames = getRawArray(t, "months").length > 0 ? getRawArray(t, "months") : MONTH_NAMES;
  const { setDirty } = useUnsavedConfig();

  const schedulesList = useMemo<Schedule[]>(
    () => initialSchedules,
    [initialSchedules]
  );
  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [roles]);
  const [orderedRoles, setOrderedRoles] = useState<Role[]>([]);
  const [initialOrder, setInitialOrder] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);

  const [selectedMonths, setSelectedMonths] = useState<
    { month: number; year: number }[]
  >([]);

  useEffect(() => {
    if (sortedRoles.length === 0) return;
    setOrderedRoles(sortedRoles);
    setInitialOrder(sortedRoles.map((r) => r.id));
  }, [sortedRoles]);

  useEffect(() => {
    if (selectedMonths.length > 0) return;
    setSelectedMonths([getNextAvailableMonth(schedulesList)]);
  }, [schedulesList, selectedMonths.length]);

  const displayRoles = orderedRoles.length > 0 ? orderedRoles : sortedRoles;
  const orderDirty = useMemo(
    () =>
      displayRoles.length !== initialOrder.length ||
      displayRoles.some((r, i) => r.id !== initialOrder[i]),
    [displayRoles, initialOrder]
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
        const errorBody = await res.json();
        alert(errorBody.error || t("errorGenerate"));
        return;
      }

      router.refresh();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="border-t border-border pt-8">
        {/* Generate form */}
        <div id="generate">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">{t("generate")}</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {t("generateHelp")}
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
                {monthNames.map((name, i) => {
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
                {generating ? t("generating") : t("generate")}
              </button>
            </div>
          )}
        </div>

        {/* Schedules list */}
        <div className="border-t border-border pt-8 mt-8">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">{t("existing")}</h2>
          {schedulesList.length === 0 ? (
            <EmptyState
              message={t("noSchedulesYet")}
              ctaLabel={t("generate")}
              ctaHref="#generate"
            />
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
                        {monthNames[schedule.month - 1]} {schedule.year}
                      </span>
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${
                          schedule.status === "committed"
                            ? "border-success/40 text-success"
                            : "border-amber-400/40 text-amber-600"
                        }`}
                      >
                        {schedule.status === "committed"
                          ? t("statusVisible")
                          : schedule.status === "draft"
                            ? t("statusDraft")
                            : schedule.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/${slug}/config/schedules/${schedule.id}`}
                        className="flex-1 min-w-0 text-center rounded-md border border-border px-3.5 py-2 text-sm hover:border-foreground transition-colors"
                      >
                        {t("edit")}
                      </Link>
                      {schedule.status === "committed" && (
                        <Link
                          href={`/${slug}/cronograma/${schedule.year}/${schedule.month}`}
                          className="flex-1 min-w-0 text-center rounded-md border border-foreground px-3.5 py-2 text-sm font-medium hover:bg-foreground hover:text-background transition-colors"
                        >
                          {t("view")}
                        </Link>
                      )}
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
              {t("columnOrder")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("columnOrderHelp")}
            </p>
          </div>
          <ColumnOrderEditor
            orderedRoles={displayRoles}
            onOrderChange={setOrderedRoles}
            moveLeftLabel={t("moveLeft")}
            moveRightLabel={t("moveRight")}
            moveUpLabel={t("moveUp")}
            moveDownLabel={t("moveDown")}
          />
          {orderDirty && (
            <button
              type="button"
              onClick={handleSaveOrder}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t("saveOrder")}
            </button>
          )}
        </section>
      </div>

    </div>
  );
}
