import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import { getTranslations } from "next-intl/server";
import RolesPageClient from "./RolesPageClient";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const ctx = await loadConfigContextForGroup(group.id, {
    include: ["roles", "exclusiveGroups", "members"],
    memberDetail: "withRoles",
  });
  const t = await getTranslations("roles");

  const roles = (ctx?.roles ?? []) as Array<{
    id: number;
    name: string;
  }>;

  const exclusiveGroups = (ctx?.exclusiveGroups ?? []) as Array<{
    id: number;
    name: string;
  }>;

  const members = (ctx?.members ?? []) as Array<{
    id: number;
    name: string;
    roleIds: number[];
  }>;

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <RolesPageClient
        slug={slug}
        groupId={group.id}
        roles={roles}
        exclusiveGroups={exclusiveGroups}
        members={members}
      />
    </div>
  );
}
