"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import LoadingScreen from "@/components/LoadingScreen";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Collaborator {
  id: number;
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
}

interface Owner {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export default function CollaboratorsPage() {
  const t = useTranslations("collaborators");
  const tCommon = useTranslations("common");
  const { groupId, loading: groupLoading } = useGroup();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [collabIdToRemove, setCollabIdToRemove] = useState<number | null>(null);
  const [removeInProgress, setRemoveInProgress] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const [collabRes, membersRes] = await Promise.all([
      fetch(`/api/groups/${groupId}/collaborators`),
      fetch(`/api/members?groupId=${groupId}`),
    ]);
    const data = await collabRes.json();
    const members = await membersRes.json();
    setOwner(data.owner);
    setCollaborators(data.collaborators);
    const ids = new Set(
      (members as { userId: string | null }[])
        .filter((m) => m.userId != null)
        .map((m) => m.userId as string)
    );
    setMemberUserIds(ids);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) queueMicrotask(() => fetchData());
  }, [groupId, fetchData]);

  // Debounced user search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (searchQuery.length < 2) {
      queueMicrotask(() => {
        setSearchResults([]);
        setShowDropdown(false);
      });
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const results = await res.json();
      const existingIds = new Set([
        owner?.id,
        ...collaborators.map((c) => c.userId),
      ]);
      const filtered = results.filter(
        (u: UserSearchResult) =>
          !existingIds.has(u.id) && memberUserIds.has(u.id)
      );
      setSearchResults(filtered);
      setShowDropdown(filtered.length > 0);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, owner, collaborators, memberUserIds]);

  const addCollaborator = async (user: UserSearchResult) => {
    if (!groupId) return;
    await fetch(`/api/groups/${groupId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    setSearchQuery("");
    setShowDropdown(false);
    setSearchResults([]);
    fetchData();
  };

  const removeCollaborator = (collabId: number) => {
    setCollabIdToRemove(collabId);
  };

  const performRemove = async () => {
    if (!groupId || collabIdToRemove == null) return;
    setRemoveInProgress(true);
    try {
      await fetch(`/api/groups/${groupId}/collaborators?collabId=${collabIdToRemove}`, {
        method: "DELETE",
      });
      fetchData();
      setCollabIdToRemove(null);
    } finally {
      setRemoveInProgress(false);
    }
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

      <div className="border-t border-border pt-8 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-12">
        {/* Left column: Owner + Add form */}
        <div className="space-y-8">
          {/* Owner */}
          {owner && (
            <div>
              <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
                {t("owner")}
              </h2>
              <div className="flex items-center gap-3">
                {owner.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                  <img src={owner.image} alt="" className="h-8 w-8 rounded-full" />
                )}
                <div>
                  <p className="text-sm font-medium">{owner.name ?? t("noName")}</p>
                  <p className="text-xs text-muted-foreground">{owner.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Add collaborator */}
          <div className={owner ? "border-t border-border pt-8 lg:border-t-0 lg:pt-0" : ""}>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
              {t("addCollaborator")}
            </h2>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                placeholder={t("searchPlaceholder")}
              />
              {showDropdown && (
                <div className="absolute z-10 top-full mt-1 w-full rounded-md border border-border bg-background shadow-sm max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => addCollaborator(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      {user.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                        <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
                      )}
                      <div>
                        <span className="text-sm block">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Collaborators list */}
        <div className="border-t border-border pt-8 mt-12 lg:border-t-0 lg:pt-0 lg:mt-0">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
            {t("count", { n: collaborators.length })}
          </h2>
          {collaborators.length === 0 ? (
            <div className="border-t border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("noCollaborators")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {collaborators.map((collab) => (
                <div key={collab.id} className="py-4 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {collab.userImage && (
                      // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                      <img src={collab.userImage} alt="" className="h-7 w-7 rounded-full shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{collab.userName ?? t("noName")}</p>
                      <p className="text-xs text-muted-foreground truncate">{collab.userEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeCollaborator(collab.id)}
                    className="shrink-0 rounded-md border border-border px-3.5 py-2 text-sm text-destructive hover:border-destructive transition-colors"
                  >
                    {tCommon("delete")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {collaborators.length > 0 && (
        <DangerZone description={t("dangerZoneDescription")}>
          <p className="text-sm text-muted-foreground">
            {t("confirmRemove")}
          </p>
        </DangerZone>
      )}

      <ConfirmDialog
        open={collabIdToRemove != null}
        onOpenChange={(open) => !open && setCollabIdToRemove(null)}
        title={t("removeCollaboratorTitle")}
        message={t("confirmRemove")}
        confirmLabel={tCommon("delete")}
        onConfirm={performRemove}
        loading={removeInProgress}
      />
    </div>
  );
}
