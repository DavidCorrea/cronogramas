import { notFound } from "next/navigation";
import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadScheduleDetail } from "@/lib/data-access";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import ScheduleDetailClient from "./ScheduleDetailClient";

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const scheduleId = parseInt(id, 10);
  if (isNaN(scheduleId)) notFound();

  const group = await getGroupForConfigLayout(slug);
  const [scheduleData, configContext] = await Promise.all([
    loadScheduleDetail(scheduleId),
    loadConfigContextForGroup(group.id, { include: ["members", "days"], memberDetail: "full" }),
  ]);

  if (!scheduleData || scheduleData.groupId !== group.id) {
    notFound();
  }

  const members = (configContext?.members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    roleIds: m.roleIds,
    availableDayIds: m.availableDayIds,
    availability: m.availability,
  }));

  const scheduleDays = (configContext?.days ?? []).map((d) => ({
    id: d.id,
    weekdayId: d.weekdayId,
    dayOfWeek: d.dayOfWeek ?? "",
    active: d.active,
    type: d.type,
    label: d.label,
    groupId: d.groupId,
  }));

  const schedule = {
    id: scheduleData.id,
    month: scheduleData.month,
    year: scheduleData.year,
    status: scheduleData.status,
    entries: scheduleData.entries,
    scheduleDates: scheduleData.scheduleDates.map((sd) => ({
      ...sd,
      type: sd.type as "assignable" | "for_everyone",
    })),
    roles: scheduleData.roles.map((r) => ({
      id: r.id,
      name: r.name,
      requiredCount: r.requiredCount,
      displayOrder: r.displayOrder,
      dependsOnRoleId: r.dependsOnRoleId,
    })),
    prevScheduleId: scheduleData.prevScheduleId,
    nextScheduleId: scheduleData.nextScheduleId,
    holidayConflicts: scheduleData.holidayConflicts,
    auditLog: scheduleData.auditLog,
  };

  return (
    <ScheduleDetailClient
      slug={slug}
      scheduleId={scheduleId}
      initialSchedule={schedule}
      initialMembers={members}
      initialScheduleDays={scheduleDays}
    />
  );
}
