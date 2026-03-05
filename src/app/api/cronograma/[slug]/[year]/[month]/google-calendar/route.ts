import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schedules, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { apiError } from "@/lib/api-helpers";
import { checkCronogramaRateLimit } from "@/lib/rate-limit";
import { resolveGroupBySlug } from "@/lib/group";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const NONCE_COOKIE_NAME = "google_calendar_nonce";
const NONCE_MAX_AGE = 600; // 10 minutes

/**
 * GET /api/cronograma/[slug]/[year]/[month]/google-calendar
 * Query: memberId (required) — the member whose assignments to add to calendar.
 * Redirects to Google OAuth. Group must have calendarExportEnabled; member must belong to group.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; year: string; month: string }> }
) {
  if (!checkCronogramaRateLimit(request)) {
    return apiError("Demasiadas solicitudes. Intenta de nuevo en un minuto.", 429, "RATE_LIMITED");
  }
  const { slug, year: yearStr, month: monthStr } = await params;
  const memberIdParam = request.nextUrl.searchParams.get("memberId");

  const group = await resolveGroupBySlug(slug);
  if (!group) {
    return apiError("Grupo no encontrado", 404, "GROUP_NOT_FOUND");
  }

  if (!group.calendarExportEnabled) {
    return apiError("Esta función no está habilitada para este grupo.", 403, "CALENDAR_EXPORT_DISABLED");
  }

  if (!memberIdParam) {
    return apiError("Se debe seleccionar una persona.", 400, "MEMBER_ID_REQUIRED");
  }
  const memberId = parseInt(memberIdParam, 10);
  if (isNaN(memberId)) {
    return apiError("memberId inválido.", 400, "VALIDATION");
  }

  const member = (await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.groupId, group.id))))[0];
  if (!member) {
    return apiError("Miembro no encontrado en este grupo.", 404, "MEMBER_NOT_FOUND");
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return apiError("Parámetros inválidos", 400, "VALIDATION");
  }

  const schedule = (await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.groupId, group.id),
        eq(schedules.month, month),
        eq(schedules.year, year),
        eq(schedules.status, "committed")
      )
    ))[0];

  if (!schedule) {
    return apiError("Agenda no encontrada", 404, "SCHEDULE_NOT_FOUND");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return apiError("Configuración de Google Calendar no disponible", 500, "CONFIG");
  }

  const origin = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/callback/google-calendar`;
  const nonce = crypto.randomUUID();
  const statePayload = { slug, year, month, memberId, nonce };
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
