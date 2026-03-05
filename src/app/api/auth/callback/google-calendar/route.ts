import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { schedules, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveGroupBySlug } from "@/lib/group";
import { buildPublicScheduleResponse } from "@/lib/public-schedule";
import { getAssignments } from "@/lib/user-assignments";

const NONCE_COOKIE_NAME = "google_calendar_nonce";

type CronogramaState = { slug: string; year: number; month: number; memberId: number; nonce: string };
type UserAssignmentsState = {
  type: "user_assignments";
  userId: string;
  groupId: number | null;
  year: number | null;
  month: number | null;
  nonce: string;
};

function isCronogramaState(decoded: unknown): decoded is CronogramaState {
  return (
    typeof decoded === "object" &&
    decoded !== null &&
    typeof (decoded as CronogramaState).slug === "string" &&
    typeof (decoded as CronogramaState).year === "number" &&
    typeof (decoded as CronogramaState).month === "number" &&
    typeof (decoded as CronogramaState).memberId === "number" &&
    typeof (decoded as CronogramaState).nonce === "string"
  );
}

function isUserAssignmentsState(decoded: unknown): decoded is UserAssignmentsState {
  return (
    typeof decoded === "object" &&
    decoded !== null &&
    (decoded as UserAssignmentsState).type === "user_assignments" &&
    typeof (decoded as UserAssignmentsState).userId === "string" &&
    typeof (decoded as UserAssignmentsState).nonce === "string"
  );
}

/**
 * GET /api/auth/callback/google-calendar
 * OAuth callback for "Save in Calendar":
 * - Cronograma: from public view (slug/year/month/memberId); inserts one member's assignments for that month.
 * - User assignments: from Mis asignaciones (userId + optional filters); inserts current user's assignments.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const origin = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  const basePath = `${origin.replace(/\/$/, "")}`;

  const redirectToCronograma = (slug: string, year: number, month: number, result: "success" | "error") => {
    const url = new URL(`/${slug}/cronograma/${year}/${month}`, basePath);
    url.searchParams.set("calendar", result);
    return NextResponse.redirect(url.toString());
  };

  const redirectToAsignaciones = (result: "success" | "error") => {
    const url = new URL("/asignaciones", basePath);
    url.searchParams.set("calendar", result);
    return NextResponse.redirect(url.toString());
  };

  if (errorParam) {
    const decoded = tryDecodeStateForError(stateRaw);
    if (decoded?.type === "user_assignments") {
      return redirectToAsignaciones("error");
    }
    if (decoded?.slug != null && decoded?.year != null && decoded?.month != null) {
      return redirectToCronograma(decoded.slug, decoded.year, decoded.month, "error");
    }
    return NextResponse.redirect(`${basePath}/?calendar=error`);
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(`${basePath}/?calendar=error`);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(`${basePath}/?calendar=error`);
  }

  const nonceCookie = request.cookies.get(NONCE_COOKIE_NAME)?.value;
  if (!nonceCookie) {
    return NextResponse.redirect(`${basePath}/?calendar=error`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/callback/google-calendar`;
  if (!clientId || !clientSecret) {
    if (isUserAssignmentsState(decoded)) return redirectToAsignaciones("error");
    if (isCronogramaState(decoded)) return redirectToCronograma(decoded.slug, decoded.year, decoded.month, "error");
    return NextResponse.redirect(`${basePath}/?calendar=error`);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  let tokens: { access_token: string };
  try {
    const { tokens: t } = await oauth2Client.getToken(code);
    if (!t.access_token) throw new Error("No access token");
    tokens = t as { access_token: string };
  } catch {
    if (isUserAssignmentsState(decoded)) return redirectToAsignaciones("error");
    if (isCronogramaState(decoded)) return redirectToCronograma(decoded.slug, decoded.year, decoded.month, "error");
    return NextResponse.redirect(`${basePath}/?calendar=error`);
  }

  oauth2Client.setCredentials(tokens);

  // —— User assignments flow (Mis asignaciones) ——
  if (isUserAssignmentsState(decoded) && decoded.nonce === nonceCookie) {
    const state = decoded;
    const [userRow] = await db
      .select({ canExportCalendars: users.canExportCalendars })
      .from(users)
      .where(eq(users.id, state.userId));

    if (!userRow?.canExportCalendars) {
      const res = redirectToAsignaciones("error");
      res.cookies.delete(NONCE_COOKIE_NAME);
      return res;
    }

    let assignments = await getAssignments(state.userId);
    assignments = assignments.filter((a) => a.groupCalendarExportEnabled);
    if (state.groupId != null) {
      assignments = assignments.filter((a) => a.groupId === state.groupId);
    }
    if (state.year != null) {
      assignments = assignments.filter((a) => a.date.slice(0, 4) === String(state.year));
    }
    if (state.month != null) {
      const monthStr = String(state.month).padStart(2, "0");
      assignments = assignments.filter((a) => a.date.slice(5, 7) === monthStr);
    }

    const byDate = new Map<string, { groupName: string; roles: string[] }>();
    for (const a of assignments) {
      const key = a.date;
      const existing = byDate.get(key);
      if (!existing) {
        byDate.set(key, { groupName: a.groupName, roles: [a.roleName] });
      } else {
        if (!existing.roles.includes(a.roleName)) existing.roles.push(a.roleName);
        if (existing.groupName !== a.groupName) {
          existing.groupName = `${existing.groupName}, ${a.groupName}`;
        }
      }
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    for (const [date, { groupName, roles: roleNames }] of byDate) {
      const rolesDesc = roleNames.length > 0 ? `Roles: ${roleNames.join(", ")}` : "";
      const [y, m, d] = date.split("-").map(Number);
      const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      try {
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: `${groupName} – ${date}`,
            description: rolesDesc,
            start: { date },
            end: { date: nextDay },
          },
        });
      } catch {
        const res = redirectToAsignaciones("error");
        res.cookies.delete(NONCE_COOKIE_NAME);
        return res;
      }
    }

    const response = redirectToAsignaciones("success");
    response.cookies.delete(NONCE_COOKIE_NAME);
    return response;
  }

  // —— Cronograma flow (public view, one member) ——
  if (isCronogramaState(decoded) && decoded.nonce === nonceCookie) {
    const state = decoded;
    const group = await resolveGroupBySlug(state.slug);
    if (!group) {
      return redirectToCronograma(state.slug, state.year, state.month, "error");
    }
    if (!group.calendarExportEnabled) {
      return redirectToCronograma(state.slug, state.year, state.month, "error");
    }

    const schedule = (await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, group.id),
          eq(schedules.month, state.month),
          eq(schedules.year, state.year),
          eq(schedules.status, "committed")
        )
      ))[0];

    if (!schedule) {
      return redirectToCronograma(state.slug, state.year, state.month, "error");
    }

    const data = await buildPublicScheduleResponse({
      id: schedule.id,
      month: schedule.month,
      year: schedule.year,
      groupId: group.id,
    });

    const groupName = data.groupName ?? "Cronograma";
    const memberEntries = (data.entries ?? []).filter((e) => e.memberId === state.memberId);
    const byDate = new Map<string, string[]>();
    for (const e of memberEntries) {
      const roles = byDate.get(e.date) ?? [];
      if (!roles.includes(e.roleName)) roles.push(e.roleName);
      byDate.set(e.date, roles);
    }
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    for (const [date, roleNames] of byDate) {
      const rolesDesc = roleNames.length > 0 ? `Roles: ${roleNames.join(", ")}` : "";
      const [y, m, d] = date.split("-").map(Number);
      const endDate = new Date(Date.UTC(y, m - 1, d + 1));
      const nextDay = endDate.toISOString().slice(0, 10);
      try {
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: `${groupName} – ${date}`,
            description: rolesDesc,
            start: { date },
            end: { date: nextDay },
          },
        });
      } catch {
        return redirectToCronograma(state.slug, state.year, state.month, "error");
      }
    }

    const response = redirectToCronograma(state.slug, state.year, state.month, "success");
    response.cookies.delete(NONCE_COOKIE_NAME);
    return response;
  }

  return NextResponse.redirect(`${basePath}/?calendar=error`);
}

function tryDecodeStateForError(
  stateRaw: string | null
): { slug?: string; year?: number; month?: number; type?: "user_assignments" } | null {
  if (!stateRaw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    if (decoded.type === "user_assignments") {
      return { type: "user_assignments" };
    }
    if (typeof decoded.slug === "string" && typeof decoded.year === "number" && typeof decoded.month === "number") {
      return { slug: decoded.slug, year: decoded.year, month: decoded.month };
    }
    return null;
  } catch {
    return null;
  }
}
