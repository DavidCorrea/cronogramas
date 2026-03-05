"use client";

import { useQuery } from "@tanstack/react-query";
import type { ConfigContextSlice } from "@/lib/load-config-context";

/** Query key prefix for config context. Use with invalidateQueries to refetch all slices for a slug. */
export function configContextQueryKey(slug: string, include?: ConfigContextSlice[]) {
  const includeKey =
    include && include.length > 0 ? [...include].sort().join(",") : "full";
  return ["config", slug, includeKey] as const;
}

export interface ConfigContextApiResponse {
  group: { id: number; name: string; slug: string };
  members?: ConfigContextData["members"];
  roles?: ConfigContextData["roles"];
  days?: ConfigContextData["days"];
  exclusiveGroups?: ConfigContextData["exclusiveGroups"];
  schedules?: ConfigContextData["schedules"];
}

/** Client shape for config context (matches API and group-context types). */
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

async function fetchConfigContext(
  slug: string,
  include?: ConfigContextSlice[]
): Promise<ConfigContextApiResponse> {
  const params = new URLSearchParams({ slug });
  if (include && include.length > 0) {
    params.set("include", include.join(","));
  }
  const res = await fetch(`/api/configuration/context?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to load config");
  }
  return res.json();
}

/**
 * View-scoped config context. Pass include to fetch only the slices this view needs.
 * Returns group + requested slices. Use refetchContext from useGroup() to invalidate after mutations.
 */
export function useConfigContext(slug: string, include?: ConfigContextSlice[]) {
  const query = useQuery({
    queryKey: configContextQueryKey(slug, include),
    queryFn: () => fetchConfigContext(slug, include),
    enabled: Boolean(slug),
  });

  const data = query.data;
  return {
    ...query,
    group: data?.group ?? null,
    members: data?.members ?? [],
    roles: data?.roles ?? [],
    days: data?.days ?? [],
    exclusiveGroups: data?.exclusiveGroups ?? [],
    schedules: data?.schedules ?? [],
  };
}
