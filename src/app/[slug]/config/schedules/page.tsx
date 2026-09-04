import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import SchedulesPageClient from "./SchedulesPageClient";

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const configContext = await loadConfigContextForGroup(group, {
    include: ["schedules", "roles"],
  });

  const schedules = (configContext?.schedules ?? []).map((s) => ({
    id: s.id,
    month: s.month,
    year: s.year,
    status: s.status,
  }));

  const roles = (configContext?.roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    displayOrder: r.displayOrder,
  }));

  return (
    <SchedulesPageClient
      slug={slug}
      groupId={group.id}
      initialSchedules={schedules}
      roles={roles}
    />
  );
}
