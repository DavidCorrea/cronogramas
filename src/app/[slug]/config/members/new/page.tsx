import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import { getTranslations } from "next-intl/server";
import BackLink from "@/components/BackLink";
import NewMemberClient from "./NewMemberClient";

export default async function NewMemberPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const ctx = await loadConfigContextForGroup(group, {
    include: ["roles"],
  });
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
          {t("addMemberTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("addMemberSubtitle")}</p>
      </div>
      <NewMemberClient slug={slug} groupId={group.id} roles={roles} />
    </div>
  );
}
