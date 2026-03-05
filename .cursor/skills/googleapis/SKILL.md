---
name: googleapis
description: Use when working with Google Calendar API, OAuth for calendar export, or inserting events into a user's Google Calendar. This project uses googleapis only for Calendar (calendar.events); no other Google APIs.
---

# googleapis (Google Calendar) in this project

## When to use

- **"Guardar en calendario" / Save to Google Calendar**: Adding the current user's assignments (or one member's assignments from the public cronograma) to the user's primary Google Calendar as all-day events.
- **Any change to OAuth flow, scopes, or event insert** for this feature should touch the routes and callback described below.

## How we use it

- **Package**: `googleapis` ^171.4.0. We use only **Calendar API v3** (`google.calendar({ version: "v3", auth })`). No other Google APIs (e.g. no Gmail, Drive).
- **Scope**: `https://www.googleapis.com/auth/calendar.events` — create/update/delete events only (no read-only calendar list needed for insert). Defined in:
  - `src/app/api/user/assignments/google-calendar/route.ts` (user assignments flow)
  - `src/app/api/cronograma/[slug]/[year]/[month]/google-calendar/route.ts` (legacy public cronograma flow)
  - Callback uses the same scope via the OAuth client.
- **Auth**: OAuth 2.0 authorization code flow. No Auth.js for this; we use a dedicated Google OAuth client (`google.auth.OAuth2`) with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and redirect URI `{origin}/api/auth/callback/google-calendar`. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; `NEXTAUTH_URL` (or request origin) for redirect URI.
- **Two entry points, one callback**:
  1. **User assignments (Mis asignaciones)**  
     - **Start**: `GET /api/user/assignments/google-calendar` (optional `?groupId=&year=&month=`). Requires session; user must have `canExportCalendars`. Sets nonce cookie, redirects to Google OAuth with state = base64url({ type: "user_assignments", userId, groupId, year, month, nonce }).
  2. **Legacy cronograma (public view, one member)**  
     - **Start**: `GET /api/cronograma/[slug]/[year]/[month]/google-calendar?memberId=`. Public (rate limited). Group must have `calendarExportEnabled`. State = base64url({ slug, year, month, memberId, nonce }).
  3. **Callback**: `GET /api/auth/callback/google-calendar`. Exchanges `code` for tokens, validates state and nonce cookie, then either (a) user-assignments: loads assignments via `getAssignments(userId)` from `src/lib/user-assignments.ts`, filters by group/year/month and `groupCalendarExportEnabled`, dedupes by date, inserts one all-day event per date into `calendarId: "primary"`; or (b) cronograma: loads schedule and member entries via `buildPublicScheduleResponse`, same insert pattern. Redirects to `/asignaciones?calendar=success|error` or `/{slug}/cronograma/{year}/{month}?calendar=success|error`.
- **Event insert**: `calendar.events.insert({ calendarId: "primary", requestBody: { summary, description, start: { date }, end: { date: nextDay } } })`. All-day: `start.date` / `end.date` as `YYYY-MM-DD`; `end` is next calendar day. Summary e.g. `"GroupName – 2025-03-15"`; description `"Roles: Role1, Role2"`. No recurrence or reminders in request body.
- **googleapis usage**: Only in the callback (`src/app/api/auth/callback/google-calendar/route.ts`): `import { google } from "googleapis"`, then `google.auth.OAuth2(...)`, `oauth2Client.getToken(code)`, `oauth2Client.setCredentials(tokens)`, `google.calendar({ version: "v3", auth: oauth2Client })`, and `calendar.events.insert(...)` in loops. The two entry-point routes do not import googleapis; they only build the OAuth URL and set the nonce cookie.

## How it should be used

- **New calendar features**: Keep using Calendar API v3 and the same OAuth client/callback if you add more event types or update existing events. Use `calendar.events.insert` / `update` / `delete` as needed; stay with scope `calendar.events` unless you need broader access.
- **Env**: Always check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` before redirecting to OAuth or in the callback; return a clear error (e.g. 500 CONFIG) or redirect with `?calendar=error` when missing.
- **Nonce**: Cookie `google_calendar_nonce` is set when starting OAuth (httpOnly, secure in prod, sameSite: lax, 10 min). Callback compares state.nonce to cookie and deletes the cookie on success or error. Do not skip nonce validation.
- **Permissions**: User assignments path checks `users.canExportCalendars` and filters assignments by `groupCalendarExportEnabled`. Cronograma path checks `group.calendarExportEnabled` and member belongs to group. Keep these checks in place.
- **Errors**: On insert failure (e.g. quota, invalid token), redirect to the same destination with `?calendar=error` and clear the nonce cookie. No need to expose Google error details to the user.

## Findings

1. **Single callback, two state shapes**: Callback discriminates with `isUserAssignmentsState(decoded)` and `isCronogramaState(decoded)`. State is base64url-encoded JSON; decoding failure or unknown shape leads to `/?calendar=error`.
2. **No refresh token handling**: We use `prompt: "consent"` so the user gets a refresh token each time. We don’t store or use refresh tokens; each "Guardar en calendario" is a full OAuth round-trip. For fewer prompts, you could store refresh tokens (encrypted) and reuse them; current design favors simplicity.
3. **Insert loop**: Events are inserted sequentially in a loop. For large sets, consider batching (Calendar API supports batch) or at least handling partial failure (e.g. continue and report "some events could not be added") if product requirements allow.
4. **All-day events**: Using `start.date` / `end.date` (no `dateTime`) is correct for all-day events; `end.date` is exclusive (next day) per API spec.
5. **Scope**: `calendar.events` is sufficient for insert; we don’t use `calendar.readonly` or `calendar` full scope.
