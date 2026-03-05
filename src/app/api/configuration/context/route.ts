import { NextRequest, NextResponse } from "next/server";
import { requireGroupAccess } from "@/lib/api-helpers";
import {
  loadConfigContextForGroup,
  CONFIG_CONTEXT_SLICES,
  type ConfigContextSlice,
} from "@/lib/load-config-context";

const SLUG_SET = new Set<string>(CONFIG_CONTEXT_SLICES);

function parseInclude(value: string | null): ConfigContextSlice[] | undefined {
  if (!value || typeof value !== "string") return undefined;
  const parts = value.split(",").map((p) => p.trim().toLowerCase());
  const included = parts.filter((p): p is ConfigContextSlice => SLUG_SET.has(p));
  return included.length > 0 ? [...new Set(included)] : undefined;
}

/**
 * BFF-style endpoint: returns group + requested config slices.
 * Query: ?slug= or ?groupId=; optional ?include=members,roles,days,exclusiveGroups,schedules (comma-separated).
 * When include is omitted, returns full context (all slices).
 */
export async function GET(request: NextRequest) {
  const accessResult = await requireGroupAccess(request);
  if (accessResult.error) return accessResult.error;
  const { groupId } = accessResult;

  const include = parseInclude(request.nextUrl.searchParams.get("include"));
  const data = await loadConfigContextForGroup(groupId, { include });
  if (!data) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
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
