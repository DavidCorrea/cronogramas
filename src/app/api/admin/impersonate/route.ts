import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, parseBody, apiError } from "@/lib/api-helpers";
import { adminImpersonateSchema } from "@/lib/schemas";

/**
 * Start impersonating a user. Session-based admins only (no bootstrap).
 * Returns { userId } for the client to call update({ impersonatedUserId: userId }).
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (adminResult.error) return adminResult.error;
  if (adminResult.isBootstrap) {
    return apiError("La suplantación requiere iniciar sesión con Google.", 403, "IMPERSONATE_BOOTSTRAP");
  }

  const raw = await request.json();
  const parsed = parseBody(adminImpersonateSchema, raw);
  if (parsed.error) return parsed.error;
  const { userId } = parsed.data;

  const target = (await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1))[0];

  if (!target) {
    return apiError("Usuario no encontrado", 404, "USER_NOT_FOUND");
  }

  return NextResponse.json({ userId: target.id });
}
