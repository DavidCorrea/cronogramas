"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useGroup } from "@/lib/group-context";
import { utcTimeToLocalDisplay } from "@/lib/timezone-utils";
import LoadingScreen from "@/components/LoadingScreen";

interface ScheduleDay {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
  active: boolean;
  type: string;
  label: string | null;
  startTimeUtc?: string;
  endTimeUtc?: string;
  groupId: number;
}

export default function EventsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { groupId, loading: groupLoading } = useGroup();
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/configuration/days?groupId=${groupId}`);
    const data = await res.json();
    setDays(data);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!groupId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      fetchData();
    });
  }, [groupId, fetchData]);

  if (groupLoading || loading) {
    return <LoadingScreen message="Cargando..." fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          Eventos
        </h1>
        <p className="mt-3 text-muted-foreground">
          Configura los días que se incluyen en el cronograma, su tipo y prioridades de roles.
        </p>
      </div>

      <div className="border-t border-border pt-8">
        <section className="space-y-4">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
            Eventos recurrentes ({days.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href={`/${slug}/config/events/new`}
              className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center min-h-[100px] text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors uppercase"
            >
              Agregar evento
            </Link>
            {days.map((day) => {
              const displayLabel = day.label?.trim() || "Evento";
              const startUtc = day.startTimeUtc ?? "00:00";
              const endUtc = day.endTimeUtc ?? "23:59";
              const start = utcTimeToLocalDisplay(startUtc);
              const end = utcTimeToLocalDisplay(endUtc);
              const timeRange = startUtc === "00:00" && endUtc === "23:59" ? "Todo el día" : `${start}–${end}`;
              const typeLabel =
                String(day.type).toLowerCase() === "for_everyone" ? "Para todos" : "Asignable";

              return (
                <Link
                  key={day.id}
                  href={`/${slug}/config/events/${day.id}`}
                  className="rounded-lg border border-border bg-card p-4 flex flex-col justify-center gap-1.5 min-h-[100px] hover:border-foreground transition-colors"
                >
                  <h3 className="text-lg font-semibold text-foreground leading-tight">
                    {displayLabel}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {day.dayOfWeek} · {timeRange}
                  </p>
                  <p className="text-xs text-muted-foreground/90">
                    {typeLabel}
                    {!day.active && " · Inactivo"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
