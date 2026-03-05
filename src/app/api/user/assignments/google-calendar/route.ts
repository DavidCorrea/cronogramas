import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/api-helpers";
import { apiError } from "@/lib/api-helpers";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const NONCE_COOKIE_NAME = "google_calendar_nonce";
const NONCE_MAX_AGE = 600; // 10 minutes

/**
 * GET /api/user/assignments/google-calendar
 * Starts Google OAuth to add the current user's assignments to their Google Calendar.
 * Query (optional): groupId, year, month — filter which assignments to export.
 * User must have canExportCalendars (set by admin).
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.user.id;

  const [userRow] = await db
    .select({ canExportCalendars: users.canExportCalendars })
    .from(users)
    .where(eq(users.id, userId));

  if (!userRow?.canExportCalendars) {
    return apiError("Esta función no está habilitada para tu cuenta.", 403, "CALENDAR_EXPORT_DISABLED");
  }

  const groupIdParam = request.nextUrl.searchParams.get("groupId");
  const yearParam = request.nextUrl.searchParams.get("year");
  const monthParam = request.nextUrl.searchParams.get("month");

  let groupId: number | undefined;
  let year: number | undefined;
  let month: number | undefined;

  if (groupIdParam) {
    groupId = parseInt(groupIdParam, 10);
    if (isNaN(groupId)) {
      return apiError("groupId inválido.", 400, "VALIDATION");
    }
  }
  if (yearParam) {
    year = parseInt(yearParam, 10);
    if (isNaN(year)) {
      return apiError("year inválido.", 400, "VALIDATION");
    }
  }
  if (monthParam) {
    month = parseInt(monthParam, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      return apiError("month inválido.", 400, "VALIDATION");
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return apiError("Configuración de Google Calendar no disponible", 500, "CONFIG");
  }

  const origin = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback/google-calendar`;
  const nonce = crypto.randomUUID();
  const statePayload = {
    type: "user_assignments" as const,
    userId,
    groupId: groupId ?? null,
    year: year ?? null,
    month: month ?? null,
    nonce,
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  const redirectUrl = `${GOOGLE_AUTH_URL}?${authParams.toString()}`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: NONCE_MAX_AGE,
    path: "/",
  });
  return response;
}
