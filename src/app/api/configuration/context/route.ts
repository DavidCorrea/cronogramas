import { NextRequest, NextResponse } from "next/server";
import { requireGroupAccess, apiError } from "@/lib/api-helpers";
import {
  loadConfigContextForGroup,
  CONFIG_CONTEXT_SLICES,
  MEMBER_DETAILS,
  type ConfigContextSlice,
  type MemberDetail,
} from "@/lib/load-config-context";

const SLUG_SET = new Set<string>(CONFIG_CONTEXT_SLICES);
const MEMBER_DETAIL_SET = new Set<string>(MEMBER_DETAILS);

function parseInclude(value: string | null): ConfigContextSlice[] | undefined {
  if (!value || typeof value !== "string") return undefined;
  // Keep case: slice names are camelCase (e.g. exclusiveGroups); toLowerCase would drop them.
  const parts = value.split(",").map((p) => p.trim());
  const included = parts.filter((p): p is ConfigContextSlice => SLUG_SET.has(p));
  return included.length > 0 ? [...new Set(included)] : undefined;
}

function parseMemberDetail(value: string | null): MemberDetail | undefined {
  if (value && MEMBER_DETAIL_SET.has(value)) return value as MemberDetail;
  return undefined;
}

/**
 * BFF-style endpoint: returns group + requested config slices.
 * Query: ?slug= or ?groupId=; optional ?include=members,roles,days,exclusiveGroups,schedules (comma-separated).
 * When include is omitted, returns full context (all slices).
 * Optional ?members=basic|withRoles|full controls the members slice granularity
 * (basic skips the role/availability queries). Defaults to full.
 */
export async function GET(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const include = parseInclude(request.nextUrl.searchParams.get("include"));
  const memberDetail = parseMemberDetail(request.nextUrl.searchParams.get("members"));
  const data = await loadConfigContextForGroup(groupId, { include, memberDetail });
  if (!data) {
    return apiError("Grupo no encontrado", 404, "NOT_FOUND");
  }

  return NextResponse.json({
    group: data.group,
    ...(data.members !== undefined && { members: data.members }),
    ...(data.roles !== undefined && { roles: data.roles }),
    ...(data.days !== undefined && { days: data.days }),
    ...(data.exclusiveGroups !== undefined && { exclusiveGroups: data.exclusiveGroups }),
    ...(data.schedules !== undefined && { schedules: data.schedules }),
  });
}
