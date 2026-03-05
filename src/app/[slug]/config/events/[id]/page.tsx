"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import EventForm from "../EventForm";
import BackLink from "@/components/BackLink";
import LoadingScreen from "@/components/LoadingScreen";

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
}

interface Role {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
  exclusiveGroupId: number | null;
}

interface PriorityRow {
  id: number;
  recurringEventId: number;
  roleId: number;
  priority: number;
  dayOfWeek: string;
  roleName: string;
}

export default function EditEventPage() {
  const params = useParams();
  const slug = params.slug as string;
  const id = params.id as string;
  const t = useTranslations("events");
  const eventId = parseInt(id, 10);
  const { groupId, loading: groupLoading } = useGroup();
  const [event, setEvent] = useState<EventData | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    if (!groupId || isNaN(eventId)) return;
    const [daysRes, rolesRes, prioritiesRes] = await Promise.all([
      fetch(`/api/configuration/days?groupId=${groupId}`),
      fetch(`/api/configuration/roles?groupId=${groupId}`),
      fetch(`/api/configuration/priorities?groupId=${groupId}`),
    ]);
    const daysData: EventData[] = await daysRes.json();
    const rolesData = await rolesRes.json();
    const prioritiesData: PriorityRow[] = await prioritiesRes.json();

    const found = daysData.find((d) => d.id === eventId) ?? null;
    setEvent(found);
    setRoles(rolesData);
    setPriorities(prioritiesData.filter((p) => p.recurringEventId === eventId));
    setNotFound(!found);
    setLoading(false);
  }, [groupId, eventId]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!groupId || isNaN(eventId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      fetchData();
    });
  }, [groupId, eventId, fetchData]);

  if (groupLoading || loading) {
    return <LoadingScreen fullPage={false} />;
  }

  if (notFound || !event) {
    return (
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-2xl uppercase">
          {t("eventNotFound")}
        </h1>
        <p className="text-muted-foreground">
          {t("eventNotFoundDesc")}
        </p>
        <Link
          href={`/${slug}/config/events`}
          className="text-sm text-accent hover:opacity-80"
        >
          {t("backToEvents")}
        </Link>
      </div>
    );
  }

  const initialPriorities = priorities.map((p) => ({
    roleId: p.roleId,
    priority: p.priority,
    roleName: p.roleName,
  }));

  return (
    <div className="space-y-12">
      <BackLink href={`/${slug}/config/events`} label={t("backToEvents")} />
      <EventForm
        slug={slug}
        groupId={groupId ?? null}
        isNew={false}
        initialEvent={event}
        roles={roles}
        initialPriorities={initialPriorities}
      />
    </div>
  );
}
