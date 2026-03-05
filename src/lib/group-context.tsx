"use client";

import { createContext, useContext, ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { configContextQueryKeyPrefix } from "@/lib/config-queries";

/** Group identity only. Config data is fetched per-view via useConfigContext(slug, include). */
export interface ConfigContextData {
  members: Array<{
    id: number;
    name: string;
    memberEmail: string | null;
    userId: string | null;
    groupId: number;
    email: string | null;
    image: string | null;
    userName: string | null;
    roleIds: number[];
    availability: Array<{ weekdayId: number; startTimeUtc: string; endTimeUtc: string }>;
    availableDayIds: number[];
  }>;
  roles: Array<{
    id: number;
    name: string;
    requiredCount: number;
    displayOrder: number;
    dependsOnRoleId: number | null;
    exclusiveGroupId: number | null;
    isRelevant: boolean;
    groupId: number;
  }>;
  days: Array<{
    id: number;
    weekdayId: number;
    dayOfWeek: string | null;
    active: boolean;
    type: string;
    label: string | null;
    startTimeUtc: string | null;
    endTimeUtc: string | null;
    groupId: number;
    notes: string | null;
  }>;
  exclusiveGroups: Array<{ id: number; name: string; groupId: number }>;
  schedules: Array<{ id: number; groupId: number; month: number; year: number; status: string }>;
}

interface GroupContextValue {
  groupId: number | null;
  slug: string;
  groupName: string;
  loading: boolean;
  error: boolean;
  /** @deprecated Use useConfigContext(slug, include) for view-scoped data. Kept for type compatibility. */
  configContext: ConfigContextData | null;
  /** Invalidates all config queries for this slug so active useConfigContext refetches. Call after mutations. */
  refetchContext: () => Promise<void>;
}

const noop = async () => {};
const GroupContext = createContext<GroupContextValue>({
  groupId: null,
  slug: "",
  groupName: "",
  loading: false,
  error: false,
  configContext: null,
  refetchContext: noop,
});

export function useGroup() {
  return useContext(GroupContext);
}

export interface InitialGroupData {
  id: number;
  name: string;
  slug: string;
}

export function GroupProvider({
  children,
  initialGroup,
}: {
  children: ReactNode;
  /** From server layout; provides group identity so client does not fetch. */
  initialGroup?: InitialGroupData | null;
  /** @deprecated Config is now loaded per-view via useConfigContext. Ignored. */
  initialConfigContext?: ConfigContextData | null;
}) {
  const params = useParams();
  const slug = (params?.slug as string) ?? initialGroup?.slug ?? "";
  const queryClient = useQueryClient();

  const groupId = initialGroup?.id ?? null;
  const groupName = initialGroup?.name ?? "";

  const refetchContext = async () => {
    if (!slug) return;
    await queryClient.invalidateQueries({ queryKey: configContextQueryKeyPrefix(slug) });
  };

  return (
    <GroupContext.Provider
      value={{
        groupId,
        slug,
        groupName,
        loading: false,
        error: false,
        configContext: null,
        refetchContext,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}
