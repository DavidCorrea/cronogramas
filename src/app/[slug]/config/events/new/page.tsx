import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import { ConfigContentSkeleton } from "@/components/Skeletons";
import BackLink from "@/components/BackLink";

const EventForm = dynamic(() => import("../EventForm"), {
  loading: () => <ConfigContentSkeleton />,
});

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const t = await getTranslations("events");
  const ctx = await loadConfigContextForGroup(group, { include: ["roles"] });
  const roles = (ctx?.roles ?? []) as Array<{
    id: number;
    name: string;
    requiredCount: number;
    displayOrder: number;
    dependsOnRoleId: number | null;
    exclusiveGroupId: number | null;
  }>;

  return (
    <div className="space-y-12">
      <BackLink href={`/${slug}/config/events`} label={t("backToEvents")} />
      <EventForm
        slug={slug}
        groupId={group.id}
        isNew={true}
        initialEvent={null}
        roles={roles}
        initialPriorities={[]}
      />
    </div>
  );
}
