"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import LoadingScreen from "@/components/LoadingScreen";

interface Role {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
  exclusiveGroupId: number | null;
  isRelevant: boolean;
}

interface Member {
  id: number;
  roleIds: number[];
}

interface ExclusiveGroup {
  id: number;
  name: string;
}

export default function RolesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const { groupId, loading: groupLoading } = useGroup();
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<ExclusiveGroup[]>([]);
  const [memberCountByRole, setMemberCountByRole] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const [newGroupName, setNewGroupName] = useState("");

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const [rolesRes, groupsRes, membersRes] = await Promise.all([
      fetch(`/api/configuration/roles?groupId=${groupId}`),
      fetch(`/api/configuration/exclusive-groups?groupId=${groupId}`),
      fetch(`/api/members?groupId=${groupId}`),
    ]);
    const rolesData = await rolesRes.json();
    const membersData = await membersRes.json();
    setRoles(rolesData);
    setGroups(await groupsRes.json());
    const counts: Record<number, number> = {};
    for (const role of rolesData) {
      counts[role.id] = (membersData as Member[]).filter((m) =>
        m.roleIds.includes(role.id)
      ).length;
    }
    setMemberCountByRole(counts);
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

  const addGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !groupId) return;
    await fetch(`/api/configuration/exclusive-groups?groupId=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    fetchData();
  };

  const deleteGroup = async (group: ExclusiveGroup) => {
    if (
      !confirm(t("confirmDeleteExclusive"))
    )
      return;
    if (!groupId) return;
    await fetch(
      `/api/configuration/exclusive-groups?id=${group.id}&groupId=${groupId}`,
      {
        method: "DELETE",
      }
    );
    fetchData();
  };

  if (groupLoading || loading) {
    return <LoadingScreen fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Roles list: cards linking to new / edit */}
      <div className="border-t border-border pt-8">
        <section className="space-y-4">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
            {t("count", { n: roles.length })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href={`/${slug}/config/roles/new`}
              className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center h-20 text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors uppercase"
            >
              {t("addRole")}
            </Link>
            {roles.map((role) => (
              <Link
                key={role.id}
                href={`/${slug}/config/roles/${role.id}`}
                className="rounded-lg border border-border bg-card p-4 flex flex-col justify-center gap-3 h-20 hover:border-foreground transition-colors"
              >
                <h3 className="font-medium truncate">{role.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {memberCountByRole[role.id] ?? 0}{" "}
                  {memberCountByRole[role.id] === 1 ? t("person") : t("people")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Grupos Exclusivos */}
      <div className="border-t border-border pt-8">
        <section className="space-y-4">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
            {t("exclusiveGroupsCount", { n: groups.length })}
          </h2>

          <p className="text-sm text-muted-foreground">
            {t("exclusiveGroupsHelp")}
          </p>

          <form onSubmit={addGroup} className="flex flex-wrap items-end gap-3 mb-4">
            <div className="min-w-[200px]">
              <label className="block text-sm text-muted-foreground mb-1.5">
                {t("newExclusiveGroup")}
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                placeholder={t("newExclusivePlaceholder")}
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {tCommon("add")}
            </button>
          </form>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noExclusiveGroups")}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-3 min-h-[80px]"
                >
                  <span className="font-medium truncate">{group.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteGroup(group)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:border-destructive transition-colors shrink-0"
                  >
                    {tCommon("delete")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
