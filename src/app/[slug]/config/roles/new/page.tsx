import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import { getTranslations } from "next-intl/server";
import BackLink from "@/components/BackLink";
import NewRoleClient from "./NewRoleClient";

export default async function NewRolePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const ctx = await loadConfigContextForGroup(group.id, {
    include: ["members", "roles", "exclusiveGroups"],
    memberDetail: "withRoles",
  });
  const t = await getTranslations("roles");

  const members = (ctx?.members ?? []) as Array<{
    id: number;
    name: string;
    roleIds: number[];
  }>;

  const roles = (ctx?.roles ?? []) as Array<{
    id: number;
    name: string;
  }>;

  const exclusiveGroups = (ctx?.exclusiveGroups ?? []) as Array<{
    id: number;
    name: string;
  }>;

  return (
    <div className="space-y-12">
      <div>
        <BackLink href={`/${slug}/config/roles`} label={t("backToRoles")} />
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {t("addRoleTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("addRoleSubtitle")}</p>
      </div>
      <NewRoleClient
        slug={slug}
        groupId={group.id}
        members={members}
        roles={roles}
        exclusiveGroups={exclusiveGroups}
      />
    </div>
  );
}
