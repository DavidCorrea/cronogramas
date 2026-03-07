"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import LoadingScreen from "@/components/LoadingScreen";
import BackLink from "@/components/BackLink";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TogglePill } from "@/components/TogglePill";

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
  name: string;
  roleIds: number[];
}

interface ExclusiveGroup {
  id: number;
  name: string;
}

function sameMemberSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const id of b) if (!sa.has(id)) return false;
  return true;
}

export default function EditRolePage() {
  const params = useParams();
  const slug = params.slug as string;
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const tConfigNav = useTranslations("configNav");
  const { groupId, loading: groupLoading, refetchContext } = useGroup();
  const { setDirty } = useUnsavedConfig();
  const [role, setRole] = useState<Role | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<ExclusiveGroup[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [roleName, setRoleName] = useState("");
  const [requiredCount, setRequiredCount] = useState(1);
  const [isRelevant, setIsRelevant] = useState(false);
  const [dependsOnRoleId, setDependsOnRoleId] = useState<number | null>(null);
  const [exclusiveGroupId, setExclusiveGroupId] = useState<number | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [formError, setFormError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const [initialSnapshot, setInitialSnapshot] = useState<{
    roleName: string;
    requiredCount: number;
    isRelevant: boolean;
    dependsOnRoleId: number | null;
    exclusiveGroupId: number | null;
    memberIds: number[];
  } | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId || !id) return;
    const roleId = parseInt(id, 10);
    if (Number.isNaN(roleId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const q = `?groupId=${groupId}`;
    const [rolesRes, groupsRes, membersRes] = await Promise.all([
      fetch(`/api/configuration/roles${q}`),
      fetch(`/api/configuration/exclusive-groups${q}`),
      fetch(`/api/members${q}`),
    ]);
    const rolesData = await rolesRes.json();
    const groupsData = await groupsRes.json();
    const membersData = await membersRes.json();
    setRoles(rolesData);
    setGroups(groupsData);
    setMembers(membersData);
    const found = rolesData.find((r: Role) => r.id === roleId);
    if (!found) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRole(found);
    setRoleName(found.name);
    setRequiredCount(found.requiredCount);
    setIsRelevant(found.isRelevant);
    setDependsOnRoleId(found.dependsOnRoleId);
    setExclusiveGroupId(found.exclusiveGroupId);
    const idsWithRole = (membersData as Member[])
      .filter((m: Member) => m.roleIds.includes(roleId))
      .map((m: Member) => m.id);
    setSelectedMemberIds(idsWithRole);
    setInitialSnapshot({
      roleName: found.name,
      requiredCount: found.requiredCount,
      isRelevant: found.isRelevant,
      dependsOnRoleId: found.dependsOnRoleId,
      exclusiveGroupId: found.exclusiveGroupId,
      memberIds: [...idsWithRole].sort((a, b) => a - b),
    });
    setLoading(false);
  }, [groupId, id]);

  useEffect(() => {
    if (groupId) queueMicrotask(() => fetchData());
  }, [groupId, fetchData]);

  const dirty = useMemo(() => {
    if (!initialSnapshot) return false;
    const formChanged =
      roleName.trim() !== initialSnapshot.roleName ||
      requiredCount !== initialSnapshot.requiredCount ||
      isRelevant !== initialSnapshot.isRelevant ||
      dependsOnRoleId !== initialSnapshot.dependsOnRoleId ||
      exclusiveGroupId !== initialSnapshot.exclusiveGroupId;
    const memberIdsChanged = !sameMemberSet(
      [...selectedMemberIds].sort((a, b) => a - b),
      initialSnapshot.memberIds
    );
    return formChanged || memberIdsChanged;
  }, [
    initialSnapshot,
    roleName,
    requiredCount,
    isRelevant,
    dependsOnRoleId,
    exclusiveGroupId,
    selectedMemberIds,
  ]);

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!roleName.trim() || !role) return;

    const roleRes = await fetch(`/api/configuration/roles?groupId=${groupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: role.id,
        name: roleName.trim(),
        requiredCount,
        dependsOnRoleId,
        exclusiveGroupId,
        isRelevant,
      }),
    });

    if (!roleRes.ok) {
      const data = await roleRes.json();
      setFormError(data.error || t("errorSave"));
      return;
    }

    const memberUpdates = members
      .map((member) => {
        const shouldHaveRole = selectedMemberIds.includes(member.id);
        const hasRole = member.roleIds.includes(role.id);
        const newRoleIds = shouldHaveRole
          ? hasRole
            ? member.roleIds
            : [...member.roleIds, role.id]
          : member.roleIds.filter((rid) => rid !== role.id);
        const changed =
          newRoleIds.length !== member.roleIds.length ||
          newRoleIds.some((rid, i) => rid !== member.roleIds[i]);
        return changed ? { memberId: member.id, newRoleIds } : null;
      })
      .filter((u): u is { memberId: number; newRoleIds: number[] } => u !== null);

    for (const { memberId, newRoleIds } of memberUpdates) {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: newRoleIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorUpdateAssignments"));
        return;
      }
    }

    setDirty(false);
    await refetchContext();
    router.push(`/${slug}/config/roles`);
  };

  const handleDelete = async () => {
    if (!role) return;
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!role || !groupId) return;
    setDeleteInProgress(true);
    try {
      const res = await fetch(
        `/api/configuration/roles?id=${role.id}&groupId=${groupId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorDelete"));
        setConfirmDeleteOpen(false);
        return;
      }
      await refetchContext();
      router.push(`/${slug}/config/roles`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  if (groupLoading || loading) {
    return <LoadingScreen fullPage={false} />;
  }

  if (notFound || !role) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("rolNotFound")}</p>
        <Link
          href={`/${slug}/config/roles`}
          className="text-sm text-primary hover:underline"
        >
          {t("backToRoles")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div>
        <BackLink href={`/${slug}/config/roles`} label={t("backToRoles")} />
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {t("editRoleTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("editRoleSubtitle")}
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {tCommon("name")}
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder={t("roleNamePlaceholderEdit")}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("maxLabel")}
            </label>
            <select
              value={requiredCount}
              onChange={(e) => setRequiredCount(parseInt(e.target.value, 10))}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-sm text-muted-foreground mb-1">{t("highlight")}</span>
            <p className="text-xs text-muted-foreground/70 mb-2">{t("helpHighlight")}</p>
            <TogglePill
              checked={isRelevant}
              onChange={setIsRelevant}
              label={t("highlight")}
              id="role-highlight"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("dependsOn")}
            </label>
            <p className="text-xs text-muted-foreground/70 mb-2">{t("helpDependsOn")}</p>
            <select
              value={dependsOnRoleId ?? ""}
              onChange={(e) =>
                setDependsOnRoleId(
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="">{t("none")}</option>
              {roles
                .filter((r) => r.id !== role.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t("exclusiveGroup")}
            </label>
            <p className="text-xs text-muted-foreground/70 mb-2">{t("helpExclusiveGroup")}</p>
            <select
              value={exclusiveGroupId ?? ""}
              onChange={(e) =>
                setExclusiveGroupId(
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="">{t("none")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">
              {t("peopleWithRole")}
            </h3>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noMembersInGroup")}
              </p>
            ) : (
              <>
                <ul className="space-y-2 mb-3">
                  {selectedMemberIds.map((memberId) => {
                    const member = members.find((m) => m.id === memberId);
                    return member ? (
                      <li
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span>{member.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMemberIds((prev) =>
                              prev.filter((id) => id !== member.id)
                            )
                          }
                          className="text-muted-foreground hover:text-foreground text-xs"
                        >
                          {t("remove")}
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
                {selectedMemberIds.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("noOneAssigned")}
                  </p>
                )}
                {members.some((m) => !selectedMemberIds.includes(m.id)) && (
                  <div>
                    <label className="sr-only" htmlFor="assign-member">
                      {t("assignPersonLabel")}
                    </label>
                    <select
                      id="assign-member"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setSelectedMemberIds((prev) => [
                          ...prev,
                          parseInt(val, 10),
                        ]);
                        e.target.value = "";
                      }}
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                    >
                      <option value="">
                        {t("selectPerson")}
                      </option>
                      {members
                        .filter((m) => !selectedMemberIds.includes(m.id))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={!roleName.trim()}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tCommon("update")}
            </button>
            <Link
              href={`/${slug}/config/roles`}
              onClick={(e) => {
                if (dirty && !window.confirm(tConfigNav("unsavedConfirm"))) {
                  e.preventDefault();
                }
              }}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              {tCommon("cancel")}
            </Link>
          </div>
        </form>

        <DangerZone>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-destructive/50 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            {tCommon("delete")}
          </button>
        </DangerZone>

      </section>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("deleteRoleTitle")}
        message={t("confirmDeleteRole", { name: role?.name ?? "" })}
        confirmLabel={tCommon("delete")}
        onConfirm={performDelete}
        loading={deleteInProgress}
      />
    </div>
  );
}
