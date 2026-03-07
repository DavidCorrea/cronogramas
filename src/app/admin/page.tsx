"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import LoadingScreen from "@/components/LoadingScreen";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TogglePill } from "@/components/TogglePill";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isAdmin: boolean;
  canCreateGroups: boolean;
  canExportCalendars: boolean;
}

interface GroupRow {
  id: number;
  name: string;
  slug: string;
  ownerId: string;
  calendarExportEnabled: boolean;
  membersCount: number;
  schedulesCount: number;
  eventsCount: number;
}

export default function AdminPage() {
  const { status, update: updateSession } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userIdToDelete, setUserIdToDelete] = useState<string | null>(null);
  const [userNameToDelete, setUserNameToDelete] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<{ id: number; name: string } | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const t = useTranslations("admin");

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      // Not authorized — check if we need to redirect to bootstrap login
      router.push("/admin/login");
      return;
    }
    if (!res.ok) {
      setError(t("errorLoadUsers"));
      setLoading(false);
      return;
    }
    setUsers(await res.json());
    setLoading(false);
  }, [router, t]);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/admin/groups");
    if (res.ok) setGroups(await res.json());
  }, []);

  const fetchAll = useCallback(async () => {
    await fetchUsers();
    const gRes = await fetch("/api/admin/groups");
    if (gRes.ok) setGroups(await gRes.json());
  }, [fetchUsers]);

  useEffect(() => {
    // Wait for session to load, then check access
    if (status === "loading") return;

    // If user has session but is not admin, or no session at all, try the API
    // The API itself handles bootstrap cookie check
    queueMicrotask(() => fetchAll());
  }, [status, fetchAll]);

  const toggleFlag = async (userId: string, flag: "isAdmin" | "canCreateGroups" | "canExportCalendars", value: boolean) => {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, [flag]: value }),
    });
    fetchUsers();
  };

  const toggleCalendarExport = async (groupId: number, value: boolean) => {
    await fetch("/api/admin/groups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, calendarExportEnabled: value }),
    });
    fetchGroups();
  };

  const deleteUser = (userId: string, userName: string | null) => {
    setUserIdToDelete(userId);
    setUserNameToDelete(userName);
  };

  const performDeleteUser = async () => {
    if (!userIdToDelete) return;
    setDeleteInProgress(true);
    try {
      await fetch(`/api/admin/users?id=${userIdToDelete}`, { method: "DELETE" });
      fetchUsers();
      setUserIdToDelete(null);
      setUserNameToDelete(null);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const deleteGroup = (group: GroupRow) => {
    setGroupToDelete({ id: group.id, name: group.name });
  };

  const performDeleteGroup = async () => {
    if (!groupToDelete) return;
    setDeleteInProgress(true);
    try {
      const res = await fetch(`/api/admin/groups?groupId=${groupToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        fetchGroups();
        setGroupToDelete(null);
      }
    } finally {
      setDeleteInProgress(false);
    }
  };

  const startImpersonating = async (userId: string) => {
    setImpersonatingUserId(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? t("errorLoadUsers"));
        return;
      }
      const data = (await res.json()) as { userId: string };
      await updateSession({ impersonatedUserId: data.userId });
      router.push("/");
    } finally {
      setImpersonatingUserId(null);
    }
  };

  if (loading) {
    return <LoadingScreen fullPage />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 sm:mt-3 text-sm sm:text-base text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Users list */}
        <section className="border-t border-border pt-6 sm:pt-8" aria-labelledby="admin-users-heading">
          <h2 id="admin-users-heading" className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-4 sm:mb-6">
            {t("usersCount", { n: users.length })}
          </h2>

          {users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("noUsers")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4"
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {user.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL; next/image would need explicit dimensions
                      <img
                        src={user.image}
                        alt=""
                        className="h-9 w-9 rounded-full shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate text-foreground">{user.name ?? t("noName")}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-col gap-1">
                    <TogglePill
                      checked={user.isAdmin}
                      onChange={(v) => toggleFlag(user.id, "isAdmin", v)}
                      label={t("adminFlag")}
                      id={`admin-${user.id}`}
                    />
                    <TogglePill
                      checked={user.canCreateGroups}
                      onChange={(v) => toggleFlag(user.id, "canCreateGroups", v)}
                      label={t("createGroupsFlag")}
                      id={`create-groups-${user.id}`}
                    />
                    <TogglePill
                      checked={user.canExportCalendars}
                      onChange={(v) => toggleFlag(user.id, "canExportCalendars", v)}
                      label={t("userCalendarExportFlag")}
                      id={`export-cal-${user.id}`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => startImpersonating(user.id)}
                      disabled={impersonatingUserId === user.id}
                      className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
                    >
                      {impersonatingUserId === user.id ? "…" : t("impersonate")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteUser(user.id, user.name)}
                      className="rounded-lg border border-border px-3 py-2 text-xs text-destructive hover:border-destructive transition-colors"
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Groups: Guardar en calendario */}
        <section className="mt-10 sm:mt-12 border-t border-border pt-6 sm:pt-8" aria-labelledby="admin-groups-heading">
          <h2 id="admin-groups-heading" className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-4 sm:mb-6">
            {t("groupsCount", { n: groups.length })}
          </h2>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noGroups")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate text-foreground">{group.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{group.slug}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("summaryCounts", {
                        members: group.membersCount,
                        events: group.eventsCount,
                        schedules: group.schedulesCount,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <TogglePill
                      checked={group.calendarExportEnabled}
                      onChange={(v) => toggleCalendarExport(group.id, v)}
                      label={t("calendarExportFlag")}
                      id={`cal-export-${group.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => deleteGroup(group)}
                      className="rounded-lg border border-border px-3 py-2 text-xs text-destructive hover:border-destructive transition-colors shrink-0"
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <ConfirmDialog
          open={userIdToDelete != null}
          onOpenChange={(open) => { if (!open) { setUserIdToDelete(null); setUserNameToDelete(null); } }}
          title={t("deleteUserTitle")}
          message={t("confirmDeleteUser", { name: userNameToDelete ?? "este usuario" })}
          confirmLabel={t("delete")}
          onConfirm={performDeleteUser}
          loading={deleteInProgress}
        />
        <ConfirmDialog
          open={groupToDelete != null}
          onOpenChange={(open) => { if (!open) setGroupToDelete(null); }}
          title={t("deleteGroupTitle")}
          message={t("confirmDeleteGroup", { name: groupToDelete?.name ?? "este grupo" })}
          confirmLabel={t("delete")}
          onConfirm={performDeleteGroup}
          loading={deleteInProgress}
        />
      </div>
    </div>
  );
}
