"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import LoadingScreen from "@/components/LoadingScreen";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isAdmin: boolean;
  canCreateGroups: boolean;
}

export default function AdminPage() {
  const { status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  useEffect(() => {
    // Wait for session to load, then check access
    if (status === "loading") return;

    // If user has session but is not admin, or no session at all, try the API
    // The API itself handles bootstrap cookie check
    queueMicrotask(() => fetchUsers());
  }, [status, fetchUsers]);

  const toggleFlag = async (userId: string, flag: "isAdmin" | "canCreateGroups", value: boolean) => {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, [flag]: value }),
    });
    fetchUsers();
  };

  const deleteUser = async (userId: string, userName: string | null) => {
    if (!confirm(t("confirmDeleteUser", { name: userName ?? "este usuario" }))) return;
    await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
    fetchUsers();
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
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl uppercase">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Users list */}
        <div className="border-t border-border pt-8">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
            {t("usersCount", { n: users.length })}
          </h2>

          {users.length === 0 ? (
            <div className="border-t border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("noUsers")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div key={user.id} className="py-5 first:pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* User info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {user.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL; next/image would need explicit dimensions
                        <img
                          src={user.image}
                          alt=""
                          className="h-9 w-9 rounded-full shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{user.name ?? t("noName")}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Toggles and actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={user.isAdmin}
                          onChange={(e) => toggleFlag(user.id, "isAdmin", e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-sm">{t("adminFlag")}</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={user.canCreateGroups}
                          onChange={(e) => toggleFlag(user.id, "canCreateGroups", e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-sm">{t("createGroupsFlag")}</span>
                      </label>

                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:border-destructive transition-colors"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            <strong>{t("adminFlag")}</strong> — {t("legendAdmin")}{" "}
            <strong>{t("createGroupsFlag")}</strong> — {t("legendCreateGroups")}
          </p>
        </div>
      </div>
    </div>
  );
}
