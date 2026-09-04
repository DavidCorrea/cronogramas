import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import { loadMemberById } from "@/lib/data-access";
import BackLink from "@/components/BackLink";
import EditMemberClient from "./EditMemberClient";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const memberId = parseInt(id, 10);
  if (Number.isNaN(memberId)) notFound();

  const group = await getGroupForConfigLayout(slug);

  const [member, ctx] = await Promise.all([
    loadMemberById(memberId),
    loadConfigContextForGroup(group, { include: ["roles"] }),
  ]);

  if (!member || member.groupId !== group.id) notFound();

  const t = await getTranslations("members");

  const roles = (ctx?.roles ?? []) as Array<{
    id: number;
    name: string;
    requiredCount: number;
  }>;

  return (
    <div className="space-y-12">
      <div>
        <BackLink
          href={`/${slug}/config/members`}
          label={t("backToMembers")}
        />
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {t("editMemberTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("editMemberSubtitle")}</p>
      </div>
      <EditMemberClient slug={slug} member={member} roles={roles} />
    </div>
  );
}
