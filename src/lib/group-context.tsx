"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "next/navigation";

interface GroupContextValue {
  groupId: number | null;
  slug: string;
  groupName: string;
  loading: boolean;
  error: boolean;
}

const GroupContext = createContext<GroupContextValue>({
  groupId: null,
  slug: "",
  groupName: "",
  loading: true,
  error: false,
});

export function useGroup() {
  return useContext(GroupContext);
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function resolve() {
      try {
        const res = await fetch(`/api/groups?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }
        const group = await res.json();
        setGroupId(group.id);
        setGroupName(group.name);
      } catch {
        setError(true);
      }
      setLoading(false);
    }
    if (slug) resolve();
  }, [slug]);

  return (
    <GroupContext.Provider value={{ groupId, slug, groupName, loading, error }}>
      {children}
    </GroupContext.Provider>
  );
}
