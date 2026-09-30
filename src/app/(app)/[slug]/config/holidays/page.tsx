import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadGroupHolidays } from "@/lib/data-access";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import HolidaysClient from "./HolidaysClient";

export default async function HolidaysPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);

  const [holidays, configContext] = await Promise.all([
    loadGroupHolidays(group.id),
    loadConfigContextForGroup(group, { include: ["members"], memberDetail: "basic" }),
  ]);

  const members = (configContext?.members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <HolidaysClient
      groupId={group.id}
      initialHolidays={holidays}
      members={members}
    />
  );
}
