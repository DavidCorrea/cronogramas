import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { groups, groupCollaborators, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveGroupBySlug } from "@/lib/group";
import { validateBootstrapToken } from "@/lib/admin-bootstrap-token";

/** Standard API error shape: { error: string, code?: string } */
export function apiError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

/**
 * Parse request body with a Zod schema. Returns parsed data or a 400 NextResponse.
 * Uses first issue message for the error body.
 */
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { data: result.data as z.infer<T> };
  }
  const first = result.error.issues[0];
  const message = first?.message ?? "Invalid request body";
  return { error: apiError(message, 400, "VALIDATION") };
}

/**
 * Extract groupId from a request's query string (?groupId=N).
 * Returns the parsed groupId or a NextResponse error.
 */
export function extractGroupId(request: NextRequest): number | NextResponse {
  const { searchParams } = new URL(request.url);
  const groupIdStr = searchParams.get("groupId");

  if (!groupIdStr) {
    return apiError("groupId query parameter is required", 400, "MISSING_GROUP_ID");
  }

  const groupId = parseInt(groupIdStr, 10);
  if (isNaN(groupId)) {
    return apiError("groupId must be a number", 400, "INVALID_GROUP_ID");
  }

  return groupId;
}

/**
 * Extract groupId from query: accepts either ?groupId=N or ?slug=xxx.
 * When slug is present, resolves it to groupId via resolveGroupBySlug.
 * Returns groupId or a NextResponse (400 missing/invalid, 404 group not found).
 */
export async function extractGroupIdOrSlug(request: NextRequest): Promise<number | NextResponse> {
  const { searchParams } = new URL(request.url);
  const groupIdStr = searchParams.get("groupId");
  const slug = searchParams.get("slug");

  if (groupIdStr) {
    const groupId = parseInt(groupIdStr, 10);
    if (isNaN(groupId)) {
      return apiError("groupId must be a number", 400, "INVALID_GROUP_ID");
    }
    return groupId;
  }

  if (slug && slug.trim()) {
    const group = await resolveGroupBySlug(slug.trim());
    if (!group) {
      return apiError("Grupo no encontrado", 404, "GROUP_NOT_FOUND");
    }
    return group.id;
  }

  return apiError("groupId or slug query parameter is required", 400, "MISSING_GROUP_ID");
}

/**
 * Get the authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getAuthUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image };
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<
  { user: { id: string; name?: string | null; email?: string | null; image?: string | null }; error?: never } |
  { user?: never; error: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: apiError("Unauthorized", 401, "UNAUTHORIZED") };
  }
  return { user };
}

/**
 * Check if a user has admin access to a group (is owner or collaborator).
 */
export async function hasGroupAccess(userId: string, groupId: number): Promise<boolean> {
  // Check if owner
  const group = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.ownerId, userId)))
    .limit(1);

  if (group.length > 0) return true;

  // Check if collaborator
  const collab = await db
    .select({ id: groupCollaborators.id })
    .from(groupCollaborators)
    .where(and(eq(groupCollaborators.groupId, groupId), eq(groupCollaborators.userId, userId)))
    .limit(1);

  return collab.length > 0;
}

/**
 * Require auth + group access. Returns user or error response.
 * Accepts either ?groupId=N or ?slug=xxx in the query.
 */
export async function requireGroupAccess(request: NextRequest): Promise<
  { user: { id: string; name?: string | null; email?: string | null; image?: string | null }; groupId: number; error?: never } |
  { user?: never; groupId?: never; error: NextResponse }
> {
  const authResult = await requireAuth();
  if (authResult.error) return { error: authResult.error };

  const groupId = await extractGroupIdOrSlug(request);
  if (groupId instanceof NextResponse) return { error: groupId };

  const access = await hasGroupAccess(authResult.user.id, groupId);
  if (!access) {
    return { error: apiError("Forbidden", 403, "FORBIDDEN") };
  }

  return { user: authResult.user, groupId };
}

/**
 * Check if any admin users exist in the database.
 */
async function hasAdminUsers(): Promise<boolean> {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);
  return admins.length > 0;
}

/**
 * Require admin access. Checks in order:
 * 1. Auth.js session with isAdmin === true
 * 2. HTTP Basic Auth against ADMIN_USERNAME/ADMIN_PASSWORD env vars (only if no admin users exist — bootstrap mode)
 * 3. Bootstrap cookie (admin-bootstrap-token) set by /api/admin/auth (only if no admin users exist)
 */
export async function requireAdmin(request: NextRequest): Promise<
  { isBootstrap: boolean; error?: never } |
  { isBootstrap?: never; error: NextResponse }
> {
  // 1. Check session-based admin (use real user id when impersonating)
  const session = await auth();
  const adminUserId = session?.realUserId ?? session?.user?.id;
  if (adminUserId) {
    // Verify isAdmin from DB (not just session, for freshness)
    const dbUser = (await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, adminUserId)))[0];
    if (dbUser?.isAdmin) {
      return { isBootstrap: false };
    }
  }

  // 2. Check bootstrap mode (Basic Auth or cookie) — only when no admin users exist
  const adminExists = await hasAdminUsers();
  if (!adminExists) {
    // Check bootstrap cookie (random token, never ADMIN_PASSWORD)
    const bootstrapToken = request.cookies.get("admin-bootstrap-token")?.value;
    if (bootstrapToken && validateBootstrapToken(bootstrapToken)) {
      return { isBootstrap: true };
    }

    // Check Basic Auth header
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Basic ")) {
      const decoded = atob(authHeader.slice(6));
      const [username, password] = decoded.split(":");
      const envUser = process.env.ADMIN_USERNAME;
      const envPass = process.env.ADMIN_PASSWORD;
      if (envUser && envPass && username === envUser && password === envPass) {
        return { isBootstrap: true };
      }
    }
  }

  return { error: apiError("Forbidden", 403, "FORBIDDEN") };
}
