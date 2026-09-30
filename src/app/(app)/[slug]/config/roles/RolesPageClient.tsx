"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/EmptyState";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Role {
  id: number;
  name: string;
}

interface ExclusiveGroup {
  id: number;
  name: string;
}

interface Member {
  id: number;
  name: string;
  roleIds: number[];
}

interface RolesPageClientProps {
  slug: string;
  groupId: number;
  roles: Role[];
  exclusiveGroups: ExclusiveGroup[];
  members: Member[];
}

export default function RolesPageClient({
  slug,
  groupId,
  roles,
  exclusiveGroups,
  members,
}: RolesPageClientProps) {
  const router = useRouter();
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const [newGroupName, setNewGroupName] = useState("");
  const [exclusiveGroupToDelete, setExclusiveGroupToDelete] =
    useState<ExclusiveGroup | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const memberCountByRole = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const r of roles) {
      counts[r.id] = members.filter((m) => m.roleIds.includes(r.id)).length;
    }
    return counts;
  }, [members, roles]);

  const addGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await fetch(`/api/configuration/exclusive-groups?groupId=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    setNewGroupName("");
    router.refresh();
  };

  const deleteGroup = (group: ExclusiveGroup) => {
    setExclusiveGroupToDelete(group);
  };

  const performDeleteGroup = async () => {
    if (!exclusiveGroupToDelete) return;
    setDeleteInProgress(true);
    try {
      const q = `?groupId=${groupId}`;
      await fetch(
        `/api/configuration/exclusive-groups/${exclusiveGroupToDelete.id}${q}`,
        { method: "DELETE" },
      );
      router.refresh();
      setExclusiveGroupToDelete(null);
    } finally {
      setDeleteInProgress(false);
    }
  };

  return (
    <>
      <div className="border-t border-border pt-8">
        <section className="space-y-4">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
            {t("count", { n: roles.length })}
          </h2>
          {roles.length === 0 ? (
            <EmptyState
              message={t("emptyMessage")}
              ctaLabel={t("addRole")}
              ctaHref={`/${slug}/config/roles/new`}
            />
          ) : (
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
                    {memberCountByRole[role.id] === 1
                      ? t("person")
                      : t("people")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="border-t border-border pt-8">
        <section className="space-y-4">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground">
            {t("exclusiveGroupsCount", { n: exclusiveGroups.length })}
          </h2>

          <p className="text-sm text-muted-foreground">
            {t("exclusiveGroupsHelp")}
          </p>

          <form
            onSubmit={addGroup}
            className="flex flex-wrap items-end gap-3 mb-4"
          >
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

          {exclusiveGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noExclusiveGroups")}
            </p>
          ) : (
            <DangerZone description={t("confirmDeleteExclusive")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {exclusiveGroups.map((group) => (
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
            </DangerZone>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={exclusiveGroupToDelete != null}
        onOpenChange={(open) => !open && setExclusiveGroupToDelete(null)}
        title={t("deleteExclusiveGroupTitle")}
        message={t("confirmDeleteExclusive")}
        confirmLabel={tCommon("delete")}
        onConfirm={performDeleteGroup}
        loading={deleteInProgress}
      />
    </>
  );
}
