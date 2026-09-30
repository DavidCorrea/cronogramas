"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
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

interface EditRoleClientProps {
  slug: string;
  groupId: number;
  role: Role;
  roles: Role[];
  exclusiveGroups: ExclusiveGroup[];
  members: Member[];
}

function sameMemberSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const id of b) if (!sa.has(id)) return false;
  return true;
}

export default function EditRoleClient({
  slug,
  groupId,
  role,
  roles,
  exclusiveGroups,
  members,
}: EditRoleClientProps) {
  const router = useRouter();
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const tConfigNav = useTranslations("configNav");
  const { setDirty } = useUnsavedConfig();

  const idsWithRole = useMemo(
    () =>
      members.filter((m) => m.roleIds.includes(role.id)).map((m) => m.id),
    [members, role.id],
  );

  const [roleName, setRoleName] = useState(role.name);
  const [requiredCount, setRequiredCount] = useState(role.requiredCount);
  const [isRelevant, setIsRelevant] = useState(role.isRelevant);
  const [dependsOnRoleId, setDependsOnRoleId] = useState<number | null>(
    role.dependsOnRoleId,
  );
  const [exclusiveGroupId, setExclusiveGroupId] = useState<number | null>(
    role.exclusiveGroupId,
  );
  const [selectedMemberIds, setSelectedMemberIds] =
    useState<number[]>(idsWithRole);
  const [formError, setFormError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const [initialSnapshot] = useState({
    roleName: role.name,
    requiredCount: role.requiredCount,
    isRelevant: role.isRelevant,
    dependsOnRoleId: role.dependsOnRoleId,
    exclusiveGroupId: role.exclusiveGroupId,
    memberIds: [...idsWithRole].sort((a, b) => a - b),
  });

  const dirty = useMemo(() => {
    const formChanged =
      roleName.trim() !== initialSnapshot.roleName ||
      requiredCount !== initialSnapshot.requiredCount ||
      isRelevant !== initialSnapshot.isRelevant ||
      dependsOnRoleId !== initialSnapshot.dependsOnRoleId ||
      exclusiveGroupId !== initialSnapshot.exclusiveGroupId;
    const memberIdsChanged = !sameMemberSet(
      [...selectedMemberIds].sort((a, b) => a - b),
      initialSnapshot.memberIds,
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

    if (!roleName.trim()) return;

    const roleRes = await fetch(
      `/api/configuration/roles?groupId=${groupId}`,
      {
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
      },
    );

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
      .filter(
        (u): u is { memberId: number; newRoleIds: number[] } => u !== null,
      );

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
    router.push(`/${slug}/config/roles`);
  };

  const handleDelete = () => {
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    setDeleteInProgress(true);
    try {
      const res = await fetch(
        `/api/configuration/roles?id=${role.id}&groupId=${groupId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorDelete"));
        setConfirmDeleteOpen(false);
        return;
      }
      setDirty(false);
      router.push(`/${slug}/config/roles`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  return (
    <>
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
              onChange={(e) =>
                setRequiredCount(parseInt(e.target.value, 10))
              }
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
            <span className="block text-sm text-muted-foreground mb-1">
              {t("highlight")}
            </span>
            <p className="text-xs text-muted-foreground/70 mb-2">
              {t("helpHighlight")}
            </p>
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
            <p className="text-xs text-muted-foreground/70 mb-2">
              {t("helpDependsOn")}
            </p>
            <select
              value={dependsOnRoleId ?? ""}
              onChange={(e) =>
                setDependsOnRoleId(
                  e.target.value ? parseInt(e.target.value, 10) : null,
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
            <p className="text-xs text-muted-foreground/70 mb-2">
              {t("helpExclusiveGroup")}
            </p>
            <select
              value={exclusiveGroupId ?? ""}
              onChange={(e) =>
                setExclusiveGroupId(
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
            >
              <option value="">{t("none")}</option>
              {exclusiveGroups.map((g) => (
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
                              prev.filter((id) => id !== member.id),
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
                {members.some(
                  (m) => !selectedMemberIds.includes(m.id),
                ) && (
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
                      <option value="">{t("selectPerson")}</option>
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
        message={t("confirmDeleteRole", { name: role.name })}
        confirmLabel={tCommon("delete")}
        onConfirm={performDelete}
        loading={deleteInProgress}
      />
    </>
  );
}
