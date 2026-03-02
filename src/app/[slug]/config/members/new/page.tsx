"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGroup } from "@/lib/group-context";
import { OptionToggleGroup } from "@/components/OptionToggleGroup";
import AvailabilityWeekGrid from "@/components/AvailabilityWeekGrid";
import { localTimeToUtc } from "@/lib/timezone-utils";
import { DAY_ORDER } from "@/lib/constants";
import LoadingScreen from "@/components/LoadingScreen";

/** Canonical 7 weekdays for availability grid (weekdayId 1–7 match DB weekdays table). */
const AVAILABILITY_WEEKDAYS: { id: number; weekdayId: number; dayOfWeek: string }[] = DAY_ORDER.map(
  (dayOfWeek, i) => ({ id: i + 1, weekdayId: i + 1, dayOfWeek })
);

interface Role {
  id: number;
  name: string;
  requiredCount: number;
}

interface WeekdayOption {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
}

export default function NewMemberPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { groupId, loading: groupLoading } = useGroup();
  const [roles, setRoles] = useState<Role[]>([]);
  const [days, setDays] = useState<WeekdayOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [availabilityLocal, setAvailabilityLocal] = useState<Record<number, { startLocal: string; endLocal: string }[]>>({});
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const q = `?groupId=${groupId}`;
    const rolesRes = await fetch(`/api/configuration/roles${q}`);
    setRoles(await rolesRes.json());
    setDays(AVAILABILITY_WEEKDAYS);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) queueMicrotask(() => fetchData());
  }, [groupId, fetchData]);

  const toggleRole = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!memberName.trim()) return;

    const availability = Object.entries(availabilityLocal).flatMap(([weekdayId, blocks]) =>
      blocks.map(({ startLocal, endLocal }) => ({
        weekdayId: parseInt(weekdayId, 10),
        startTimeUtc: localTimeToUtc(startLocal),
        endTimeUtc: localTimeToUtc(endLocal),
      }))
    );

    const res = await fetch(`/api/members?groupId=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: memberName.trim(),
        email: memberEmail.trim() || null,
        roleIds: selectedRoles,
        availability,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || "Error al guardar el miembro");
      return;
    }

    router.push(`/${slug}/config/members`);
  };

  if (groupLoading || loading) {
    return <LoadingScreen message="Cargando..." fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          Agregar miembro
        </h1>
        <p className="mt-3 text-muted-foreground">
          Completa los datos del nuevo miembro del grupo.
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="max-w-md">
            <label className="block text-sm text-muted-foreground mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder="Nombre del miembro"
              required
            />
          </div>

          <div className="max-w-md">
            <label className="block text-sm text-muted-foreground mb-1.5">
              Email <span className="text-muted-foreground/50">(opcional)</span>
            </label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <OptionToggleGroup
              items={roles}
              getKey={(r) => r.id}
              getLabel={(r) => r.name}
              isSelected={(r) => selectedRoles.includes(r.id)}
              onToggle={(r) => toggleRole(r.id)}
              title="Roles"
            />
          </div>

          <div>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
              Días y horarios disponibles
            </h2>
            <AvailabilityWeekGrid
              days={days}
              availability={availabilityLocal}
              onChange={setAvailabilityLocal}
              gridHeight={330}
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!memberName.trim()}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agregar miembro
            </button>
            <Link
              href={`/${slug}/config/members`}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
