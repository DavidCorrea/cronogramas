"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useGroup } from "@/lib/group-context";
import EventForm from "../EventForm";
import LoadingScreen from "@/components/LoadingScreen";

interface Role {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
  exclusiveGroupId: number | null;
}

export default function NewEventPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { groupId, loading: groupLoading } = useGroup();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/configuration/roles?groupId=${groupId}`);
    const data = await res.json();
    setRoles(data);
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
    <EventForm
      slug={slug}
      groupId={groupId ?? null}
      isNew={true}
      initialEvent={null}
      roles={roles}
      initialPriorities={[]}
    />
  );
}
