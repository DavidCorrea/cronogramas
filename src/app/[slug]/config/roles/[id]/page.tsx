import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadConfigContextForGroup } from "@/lib/load-config-context";
import BackLink from "@/components/BackLink";
import EditRoleClient from "./EditRoleClient";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const roleId = parseInt(id, 10);
  if (Number.isNaN(roleId)) notFound();

  const group = await getGroupForConfigLayout(slug);
  const ctx = await loadConfigContextForGroup(group, {
    include: ["roles", "exclusiveGroups", "members"],
    memberDetail: "withRoles",
  });
  const t = await getTranslations("roles");

  const roles = (ctx?.roles ?? []) as Array<{
    id: number;
    name: string;
    requiredCount: number;
    displayOrder: number;
    dependsOnRoleId: number | null;
    exclusiveGroupId: number | null;
    isRelevant: boolean;
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

  const role = roles.find((r) => r.id === roleId);
  if (!role) notFound();

  return (
    <div className="space-y-12">
      <div>
        <BackLink href={`/${slug}/config/roles`} label={t("backToRoles")} />
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {t("editRoleTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("editRoleSubtitle")}</p>
      </div>
      <EditRoleClient
        slug={slug}
        groupId={group.id}
        role={role}
        roles={roles}
        exclusiveGroups={exclusiveGroups}
        members={members}
      />
    </div>
  );
}
