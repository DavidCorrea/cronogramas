"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGroup } from "@/lib/group-context";
import { useUnsavedConfig } from "@/lib/unsaved-config-context";
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
  const { groupId, loading: groupLoading } = useGroup();
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
      setFormError(data.error || "Error al guardar el rol");
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
        setFormError(data.error || "Error al actualizar asignaciones");
        return;
      }
    }

    setDirty(false);
    router.push(`/${slug}/config/roles`);
  };

  const handleDelete = async () => {
    if (
      !role ||
      !confirm(
        `¿Eliminar "${role.name}"? Esto también eliminará todas las entradas de cronograma para este rol.`
      )
    )
      return;
    const res = await fetch(
      `/api/configuration/roles?id=${role.id}&groupId=${groupId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || "Error al eliminar el rol");
      return;
    }
    router.push(`/${slug}/config/roles`);
  };

  if (groupLoading || loading) {
    return <LoadingScreen message="Cargando..." fullPage={false} />;
  }

  if (notFound || !role) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Rol no encontrado.</p>
        <Link
          href={`/${slug}/config/roles`}
          className="text-sm text-primary hover:underline"
        >
          Volver a Roles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          Editar rol
        </h1>
        <p className="mt-3 text-muted-foreground">
          Modifica el rol y sus opciones.
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder="Nombre del rol"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Máximo
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
            <span className="text-sm text-muted-foreground">Resaltar</span>
          </label>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Depende de
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
              <option value="">Ninguno</option>
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
            <label className="block text-sm text-muted-foreground mb-1.5">
              Grupo exclusivo
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
              <option value="">Ninguno</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">
              Personas con este rol
            </h3>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay miembros en el grupo.
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
                          Quitar
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
                {selectedMemberIds.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Ninguna persona asignada aún.
                  </p>
                )}
                {members.some((m) => !selectedMemberIds.includes(m.id)) && (
                  <div>
                    <label className="sr-only" htmlFor="assign-member">
                      Asignar persona al rol
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
                        Seleccionar persona…
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
              Actualizar
            </button>
            <Link
              href={`/${slug}/config/roles`}
              onClick={(e) => {
                if (dirty && !window.confirm("Hay cambios sin guardar. ¿Salir de todas formas?")) {
                  e.preventDefault();
                }
              }}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md border border-border px-5 py-2.5 text-sm text-destructive hover:border-destructive hover:bg-destructive/10 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </form>

        <div className="border border-border rounded-md p-5 text-sm text-muted-foreground space-y-2 w-full mt-8">
          <p>
            <span className="font-medium text-foreground">Depende de:</span>{" "}
            El rol no se asigna automáticamente. Al generar el cronograma, se
            elige manualmente entre los miembros asignados al rol del que depende.
          </p>
          <p>
            <span className="font-medium text-foreground">Grupo exclusivo:</span>{" "}
            Dos roles del mismo grupo no pueden asignarse a la misma persona en
            la misma fecha.
          </p>
          <p>
            <span className="font-medium text-foreground">Resaltar:</span>{" "}
            Las fechas donde un miembro tiene un rol con Resaltar se resaltan en la
            vista compartida al filtrar por esa persona.
          </p>
        </div>
      </section>
    </div>
  );
}
