"use client";

import { useEffect, useState, useCallback } from "react";
import { useGroup } from "@/lib/group-context";
import { formatDateRangeWithYear } from "@/lib/timezone-utils";
import LoadingScreen from "@/components/LoadingScreen";

interface MemberOption {
  id: number;
  name: string;
}

interface HolidayEntry {
  id: number;
  memberId: number | null;
  userId: string | null;
  startDate: string;
  endDate: string;
  description: string | null;
  memberName: string;
  source: "member" | "user";
}

function formatDateRange(start: string, end: string): string {
  return formatDateRangeWithYear(start, end);
}

export default function HolidaysPage() {
  const { groupId, loading: groupLoading } = useGroup();
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [memberId, setMemberId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const [holidaysRes, membersRes] = await Promise.all([
      fetch(`/api/configuration/holidays?groupId=${groupId}`),
      fetch(`/api/members?groupId=${groupId}`),
    ]);
    setHolidays(await holidaysRes.json());
    const membersData = await membersRes.json();
    setMemberOptions(
      membersData.map((m: { id: number; name: string }) => ({
        id: m.id,
        name: m.name,
      }))
    );
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) queueMicrotask(() => fetchData());
  }, [groupId, fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!memberId || !startDate || !endDate) {
      setError("Todos los campos son obligatorios");
      return;
    }

    if (startDate > endDate) {
      setError("La fecha de inicio debe ser anterior o igual a la fecha de fin");
      return;
    }

    const res = await fetch(`/api/configuration/holidays?groupId=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: Number(memberId),
        startDate,
        endDate,
        description: description.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al crear la fecha");
      return;
    }

    setMemberId("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/configuration/holidays?id=${id}&groupId=${groupId}`, {
      method: "DELETE",
    });
    fetchData();
  };

  const userHolidays = holidays.filter((h) => h.source === "user");
  const memberHolidays = holidays.filter((h) => h.source === "member");

  if (groupLoading || loading) {
    return <LoadingScreen message="Cargando..." fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          Vacaciones
        </h1>
        <p className="mt-3 text-muted-foreground">
          Gestiona fechas de ausencia de los miembros del grupo.
        </p>
      </div>

      <div className="border-t border-border pt-8 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-12">
        {/* Add holiday form */}
        <div>
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
            Agregar ausencia
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configura una fecha de ausencia para un miembro específico de este grupo.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Miembro
              </label>
              <select
                value={memberId}
                onChange={(e) =>
                  setMemberId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                required
              >
                <option value="">Seleccionar miembro...</option>
                {memberOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                Descripción
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                placeholder="Opcional"
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Desde
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Hasta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Agregar
            </button>
          </form>
        </div>

        {/* Holiday lists */}
        <div className="border-t border-border pt-8 mt-12 lg:border-t-0 lg:pt-0 lg:mt-0 space-y-10">
          {/* Group holidays (admin-set) */}
          <div>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
              Ausencias del grupo
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Fechas configuradas por los administradores para miembros de este grupo.
            </p>

            {memberHolidays.length === 0 ? (
              <div className="border-t border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay ausencias configuradas para este grupo.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {memberHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="py-4 first:pt-0 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{h.memberName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateRange(h.startDate, h.endDate)}
                      </p>
                      {h.description && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {h.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="shrink-0 rounded-md border border-border px-3.5 py-2 text-sm text-destructive hover:border-destructive transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User holidays (personal, read-only) */}
          {userHolidays.length > 0 && (
            <div className="border-t border-border pt-8">
              <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
                Ausencias personales
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Fechas configuradas por los propios miembros desde sus ajustes personales. Aplican a todos sus grupos.
              </p>

              <div className="divide-y divide-border">
                {userHolidays.map((h) => (
                  <div key={h.id} className="py-4 first:pt-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{h.memberName}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Personal
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(h.startDate, h.endDate)}
                    </p>
                    {h.description && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {h.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
