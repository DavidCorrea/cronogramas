"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
import LoadingScreen from "@/components/LoadingScreen";

interface Member {
  id: number;
  name: string;
  roleIds: number[];
}

interface Role {
  id: number;
  name: string;
}

interface ExclusiveGroup {
  id: number;
  name: string;
}

export default function NewRolePage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const tConfigNav = useTranslations("configNav");
  const { groupId, loading: groupLoading } = useGroup();
  const { setDirty } = useUnsavedConfig();
  const [roleName, setRoleName] = useState("");
  const [requiredCount, setRequiredCount] = useState(1);
  const [isRelevant, setIsRelevant] = useState(false);
  const [dependsOnRoleId, setDependsOnRoleId] = useState<number | null>(null);
  const [exclusiveGroupId, setExclusiveGroupId] = useState<number | null>(null);
  const [memberIdsToAssign, setMemberIdsToAssign] = useState<number[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<ExclusiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const q = `?groupId=${groupId}`;
    const [membersRes, rolesRes, groupsRes] = await Promise.all([
      fetch(`/api/members${q}`),
      fetch(`/api/configuration/roles${q}`),
      fetch(`/api/configuration/exclusive-groups${q}`),
    ]);
    setMembers(await membersRes.json());
    setRoles(await rolesRes.json());
    setGroups(await groupsRes.json());
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) queueMicrotask(() => fetchData());
  }, [groupId, fetchData]);

  const dirty =
    roleName.trim() !== "" ||
    requiredCount !== 1 ||
    isRelevant ||
    dependsOnRoleId !== null ||
    exclusiveGroupId !== null ||
    memberIdsToAssign.length > 0;

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

    if (!roleName.trim() || !groupId) return;

    const roleRes = await fetch(`/api/configuration/roles?groupId=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    const role = await roleRes.json();

    for (const memberId of memberIdsToAssign) {
      const member = members.find((m) => m.id === memberId);
      if (!member) continue;
      const newRoleIds = [...member.roleIds, role.id];
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: newRoleIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorAssign"));
        return;
      }
    }

    setDirty(false);
    router.push(`/${slug}/config/roles`);
  };

  if (groupLoading || loading) {
    return <LoadingScreen fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          {t("addRoleTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("addRoleSubtitle")}
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("roleNameLabel")}
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder={t("roleNamePlaceholder")}
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

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRelevant}
              onChange={(e) => setIsRelevant(e.target.checked)}
              className="rounded border-border w-4 h-4"
            />
            <span className="text-sm text-muted-foreground">{t("highlight")}</span>
          </label>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("dependsOn")}
            </label>
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
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("exclusiveGroup")}
            </label>
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
              {t("assignPeople")}
            </h3>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noMembersInGroup")}
              </p>
            ) : (
              <>
                <ul className="space-y-2 mb-3">
                  {memberIdsToAssign.map((memberId) => {
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
                            setMemberIdsToAssign((prev) =>
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
                {memberIdsToAssign.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("noOneAssigned")}
                  </p>
                )}
                {members.some((m) => !memberIdsToAssign.includes(m.id)) && (
                  <div>
                    <label className="sr-only" htmlFor="assign-member-new">
                      {t("assignPersonLabel")}
                    </label>
                    <select
                      id="assign-member-new"
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setMemberIdsToAssign((prev) => [
                          ...prev,
                          parseInt(val, 10),
                        ]);
                        e.target.value = "";
                      }}
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                    >
                      <option value="">{t("selectPerson")}</option>
                      {members
                        .filter((m) => !memberIdsToAssign.includes(m.id))
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

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!roleName.trim()}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("addRoleButton")}
            </button>
            <Link
              href={`/${slug}/config/roles`}
              onClick={(e) => {
                if (
                  dirty &&
                  !window.confirm(tConfigNav("unsavedConfirm"))
                ) {
                  e.preventDefault();
                }
              }}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              {tCommon("cancel")}
            </Link>
          </div>
        </form>

        <div className="border border-border rounded-md p-5 text-sm text-muted-foreground space-y-2 w-full mt-8">
          <p>
            <span className="font-medium text-foreground">{t("dependsOn")}:</span>{" "}
            {t("helpDependsOn")}
          </p>
          <p>
            <span className="font-medium text-foreground">{t("exclusiveGroup")}:</span>{" "}
            {t("helpExclusiveGroup")}
          </p>
          <p>
            <span className="font-medium text-foreground">{t("highlight")}:</span>{" "}
            {t("helpHighlight")}
          </p>
        </div>
      </section>
    </div>
  );
}
