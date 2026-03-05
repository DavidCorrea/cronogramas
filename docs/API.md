# API Reference

## 1. Overview

All API routes are **Next.js App Router route handlers** under `src/app/api`. Routes are organized by domain (auth, admin, groups, members, schedules, configuration, cronograma, user, holidays). **Auth**: most routes require a **session** (Auth.js via `requireAuth()` or `requireGroupAccess()` in `src/lib/api-helpers.ts`); **Admin** routes use `requireAdmin()` (session `isAdmin` or bootstrap Basic Auth/cookie when no admin users exist). **Public** routes are `/api/cronograma/[slug]` and `/api/cronograma/[slug]/[year]/[month]` (no auth; group identified by path `:slug`; **rate limited** by IP). Group-scoped routes accept either **`?groupId=N`** or **`?slug=xxx`** in the query (when the route uses `requireGroupAccess` or `extractGroupIdOrSlug`); config pages can pass `slug` from the router and avoid a separate "resolve group" fetch.

**Error responses** use a single shape: `{ error: string, code?: string }`. Status codes: `400` validation, `403` forbidden, `404` not found, `409` conflict, `429` rate limited. Helper: `apiError(message, status, code)` in `src/lib/api-helpers.ts`.

**Rate limiting and client identification:** Public cronograma and admin-auth/user-search rate limiters use the client IP from `x-forwarded-for` or `x-real-ip` when present. When the app is behind a **trusted reverse proxy** (e.g. Vercel), ensure the proxy sets and overwrites these headers; the app trusts them for rate limiting. Without a trusted proxy, clients could spoof these headers and bypass per-IP limits. For production at scale, consider a Redis-backed limiter (e.g. @upstash/ratelimit).

**DELETE semantics**: Prefer path parameters for deletes, e.g. `DELETE /api/configuration/holidays/[id]` and `DELETE /api/configuration/exclusive-groups/[id]` with group from query (`?groupId=` or `?slug=`). Avoid `?id=...&groupId=...` on the collection URL.

---

## 2. Route index

### Auth
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET, POST | `/api/auth/[...nextauth]` | Auth.js session (sign-in, callback, session) | `src/app/api/auth/[...nextauth]/route.ts` |

### Admin
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| POST | `/api/admin/auth` | Bootstrap admin auth (set short-lived random token cookie when no admin users); validates ADMIN_USERNAME/ADMIN_PASSWORD; **rate limited** (strict per IP). | `src/app/api/admin/auth/route.ts` |
| GET | `/api/admin/users` | List all users (admin only) | `src/app/api/admin/users/route.ts` |
| PUT | `/api/admin/users` | Update user (isAdmin, canCreateGroups, canExportCalendars) | `src/app/api/admin/users/route.ts` |
| DELETE | `/api/admin/users` | Delete user by `id` query param | `src/app/api/admin/users/route.ts` |
| GET | `/api/admin/groups` | List all groups (admin only); returns calendarExportEnabled per group | `src/app/api/admin/groups/route.ts` |
| PATCH | `/api/admin/groups` | Update group (body: groupId, calendarExportEnabled) | `src/app/api/admin/groups/route.ts` |
| DELETE | `/api/admin/groups` | Delete group by `groupId` query param (admin only). Cascades to members, schedules, config, etc. | `src/app/api/admin/groups/route.ts` |
| POST | `/api/admin/impersonate` | Start impersonating a user (session-based admin only; body: `userId`). Returns `{ userId }` for client to call `update({ impersonatedUserId })`. Bootstrap admins get 403. | `src/app/api/admin/impersonate/route.ts` |
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/groups` | List groups for current user, or get one by `?slug=` (requires group access when slug provided) | `src/app/api/groups/route.ts` |
| POST | `/api/groups` | Create group (name, slug, days, roles, collaboratorUserIds) | `src/app/api/groups/route.ts` |
| GET | `/api/groups/[id]/collaborators` | List collaborators for group | `src/app/api/groups/[id]/collaborators/route.ts` |
| POST | `/api/groups/[id]/collaborators` | Add collaborator (userId) | `src/app/api/groups/[id]/collaborators/route.ts` |
| DELETE | `/api/groups/[id]/collaborators` | Remove collaborator by `userId` query param | `src/app/api/groups/[id]/collaborators/route.ts` |

### Members
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/members` | List members for group (`?groupId=`) | `src/app/api/members/route.ts` |
| POST | `/api/members` | Create member in group | `src/app/api/members/route.ts` |
| GET | `/api/members/[id]` | Get member by id (with roles, availability) | `src/app/api/members/[id]/route.ts` |
| PUT | `/api/members/[id]` | Update member | `src/app/api/members/[id]/route.ts` |
| DELETE | `/api/members/[id]` | Delete member | `src/app/api/members/[id]/route.ts` |
| GET | `/api/members/[id]/link-check` | Check if member can be linked to a user by email | `src/app/api/members/[id]/link-check/route.ts` |

### Schedules
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/schedules` | List schedules for group (`?groupId=`) | `src/app/api/schedules/route.ts` |
| POST | `/api/schedules` | Create schedule (month, year) for group | `src/app/api/schedules/route.ts` |
| GET | `/api/schedules/[id]` | Get full schedule by id (dates, assignments, prev/next) | `src/app/api/schedules/[id]/route.ts` |
| PUT | `/api/schedules/[id]` | Update schedule (assignments, status, etc.) | `src/app/api/schedules/[id]/route.ts` |
| DELETE | `/api/schedules/[id]` | Delete schedule | `src/app/api/schedules/[id]/route.ts` |
| GET | `/api/schedules/[id]/notes` | Get date notes for schedule (auth + group access required) | `src/app/api/schedules/[id]/notes/route.ts` |
| POST | `/api/schedules/[id]/notes` | Save note for a date | `src/app/api/schedules/[id]/notes/route.ts` |
| DELETE | `/api/schedules/[id]/notes` | Delete note for a date (`?date=`) | `src/app/api/schedules/[id]/notes/route.ts` |

### Configuration (context, days, roles, priorities, exclusive-groups, holidays)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/configuration/context` | BFF: group + config slices. Query: `?slug=` or `?groupId=`. Optional **`?include=members,roles,days,exclusiveGroups,schedules`** (comma-separated) to return only those slices (view-scoped). Omit `include` for full context. | `src/app/api/configuration/context/route.ts` |
| GET | `/api/configuration/days` | List recurring days for group (`?groupId=`) | `src/app/api/configuration/days/route.ts` |
| PUT | `/api/configuration/days` | Update existing day (active, type, label, times, notes) | `src/app/api/configuration/days/route.ts` |
| POST | `/api/configuration/days` | Create new recurring day | `src/app/api/configuration/days/route.ts` |
| DELETE | `/api/configuration/days/[id]` | Delete recurring day | `src/app/api/configuration/days/[id]/route.ts` |
| GET | `/api/configuration/days/[id]/affected-schedule-dates` | List schedule dates affected by day change | `src/app/api/configuration/days/[id]/affected-schedule-dates/route.ts` |
| POST | `/api/configuration/days/[id]/recalculate-assignments` | Recalculate assignments after day change | `src/app/api/configuration/days/[id]/recalculate-assignments/route.ts` |
| GET | `/api/configuration/roles` | List roles for group (`?groupId=`) | `src/app/api/configuration/roles/route.ts` |
| POST | `/api/configuration/roles` | Create role | `src/app/api/configuration/roles/route.ts` |
| PUT | `/api/configuration/roles` | Update role | `src/app/api/configuration/roles/route.ts` |
| PATCH | `/api/configuration/roles` | Reorder roles (displayOrder) | `src/app/api/configuration/roles/route.ts` |
| DELETE | `/api/configuration/roles` | Delete role | `src/app/api/configuration/roles/route.ts` |
| GET | `/api/configuration/priorities` | List event–role priorities for group | `src/app/api/configuration/priorities/route.ts` |
| POST, PUT, DELETE | `/api/configuration/priorities` | Create/update/delete priorities | `src/app/api/configuration/priorities/route.ts` |
| GET | `/api/configuration/exclusive-groups` | List exclusive groups for group (`?groupId=` or `?slug=`) | `src/app/api/configuration/exclusive-groups/route.ts` |
| POST | `/api/configuration/exclusive-groups` | Create exclusive group | `src/app/api/configuration/exclusive-groups/route.ts` |
| DELETE | `/api/configuration/exclusive-groups/[id]` | Delete exclusive group (`?groupId=` or `?slug=`) | `src/app/api/configuration/exclusive-groups/[id]/route.ts` |
| GET | `/api/configuration/holidays` | List member holidays for group | `src/app/api/configuration/holidays/route.ts` |
| POST | `/api/configuration/holidays` | Create member holiday | `src/app/api/configuration/holidays/route.ts` |
| DELETE | `/api/configuration/holidays/[id]` | Delete member holiday (`?groupId=` or `?slug=`) | `src/app/api/configuration/holidays/[id]/route.ts` |

### Cronograma (public)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/cronograma/[slug]` | Public schedule for group by slug (current or latest committed). Page `/[slug]/cronograma` redirects (302) to `/[slug]/cronograma/[year]/[month]` for current month. **Rate limited** by IP. | `src/app/api/cronograma/[slug]/route.ts` |
| GET | `/api/cronograma/[slug]/[year]/[month]` | Public schedule for group by slug, year, month. **Rate limited** by IP. | `src/app/api/cronograma/[slug]/[year]/[month]/route.ts` |
| GET | `/api/cronograma/[slug]/[year]/[month]/google-calendar` | Redirects to Google OAuth to add the **selected member's** assignments to the user's Google Calendar. Query **`?memberId=`** required. Group must have `calendarExportEnabled`. **Rate limited**. Callback: `/api/auth/callback/google-calendar`. | `src/app/api/cronograma/[slug]/[year]/[month]/google-calendar/route.ts` |

### Auth callback (Google Calendar, one-off)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/auth/callback/google-calendar` | OAuth callback: (1) **User assignments**: state `type: "user_assignments"` — insert current user's assignments (filtered by group/year/month, only groups with calendarExportEnabled) into primary Google Calendar, redirect to `/asignaciones?calendar=success|error`. (2) **Cronograma**: state slug/year/month/memberId — insert selected member's assignments for that month, redirect to cronograma page. Add this URI to Google Cloud Console. | `src/app/api/auth/callback/google-calendar/route.ts` |

### User (dashboard, search)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/user/dashboard` | Dashboard: assignments (with groupCalendarExportEnabled), conflicts, **canExportCalendars** (user flag, set by admin). | `src/app/api/user/dashboard/route.ts` |
| GET | `/api/user/assignments/google-calendar` | Redirects to Google OAuth to add **current user's** assignments to Google Calendar. Auth required; user must have **canExportCalendars** (set by admin). Optional query: `groupId`, `year`, `month`. Callback redirects to `/asignaciones?calendar=success|error`. | `src/app/api/user/assignments/google-calendar/route.ts` |
| GET | `/api/users/search` | Search users by name/email (`?q=`) for linking/invites. Requires **groupId or slug** and group access (e.g. add collaborator). **Rate limited** per IP. | `src/app/api/users/search/route.ts` |

### Holidays (user-scoped)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/holidays` | List current user's holidays | `src/app/api/holidays/route.ts` |
| POST | `/api/holidays` | Create user holiday (startDate, endDate, description) | `src/app/api/holidays/route.ts` |
| DELETE | `/api/holidays` | Delete user holiday (`?id=`) | `src/app/api/holidays/route.ts` |

---

## 3. Per-domain summary

- **Auth** — NextAuth.js catch-all: `GET`/`POST` for sign-in, callback, session. Handlers from `src/lib/auth.ts`. Session required for all other authenticated routes.

- **Admin** — Bootstrap and user management. **Auth**: `requireAdmin()`. **Users**: GET/PUT/DELETE; PUT body can include **canExportCalendars** (per-user "Guardar en calendario" flag, admin-only). **Groups**: GET (list with calendarExportEnabled), PATCH (body: groupId, calendarExportEnabled) to enable/disable "Guardar en calendario" per group, **DELETE** (`?groupId=`) to remove a group and all its data (cascades). **Impersonation**: POST `/api/admin/impersonate` (body: userId) for session-based admins only; returns `{ userId }` so client can call `update({ impersonatedUserId })`; bootstrap admins receive 403.

- **Groups** — List/create groups and manage collaborators. **Auth**: `requireAuth()` for list/create; `requireAuth()` + `hasGroupAccess(userId, groupId)` for `[id]/collaborators`. Path param `[id]` is group id. Helpers: `src/lib/api-helpers.ts`.

- **Members** — CRUD for group members (and link-check). **Auth**: `requireGroupAccess(request)` for list/create (accepts `?groupId=` or `?slug=`); for `[id]` and link-check, `requireAuth()` plus **resource-level group check** via `hasGroupAccess(userId, resource.groupId)`. File: `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`, `src/app/api/members/[id]/link-check/route.ts`.

- **Schedules** — Schedules and date notes. **Auth**: `requireGroupAccess(request)` for list/create (accepts `?groupId=` or `?slug=`); for `[id]` and notes POST/DELETE/GET, `requireAuth()` plus **resource-level group check** (schedule’s groupId). Helpers: `src/lib/schedule-helpers.ts`, `src/lib/scheduler.ts`, `src/lib/audit-log.ts`.

- **Configuration** — Days (recurring events), roles, priorities, exclusive-groups, group-scoped holidays. **Auth**: All use `requireGroupAccess(request)` (accepts `?groupId=` or `?slug=`). DELETE by path: `DELETE /api/configuration/holidays/[id]` and `DELETE /api/configuration/exclusive-groups/[id]` with group in query. Request bodies validated with **Zod** schemas in `src/lib/schemas/` where applicable. Types/schema: `src/db/schema.ts`.

- **Cronograma** — Public read-only schedule by group slug. **Auth**: None. **Rate limiting**: in-memory per IP. Optional GET `.../google-calendar?memberId=` (group must have calendarExportEnabled) redirects to Google OAuth; callback can insert that member's assignment dates (description = roles). **Save in Calendar** is primarily on **Mis asignaciones** (see User below).

- **User** — Dashboard (assignments with groupCalendarExportEnabled, conflicts, user's canExportCalendars), GET `/api/user/assignments/google-calendar` to start OAuth for "Guardar en calendario" (user must have canExportCalendars set by admin). Search: `GET /api/users/search` requires **groupId or slug** + group access and is rate limited.

- **Holidays** — User-level holidays (unavailability). **Auth**: `requireAuth()`. Scoped by `userId` from session; DELETE checks `existing.userId === authResult.user.id`.

---

## 4. Where to look

- **To add a new endpoint:** Add a `route.ts` under the right segment in `src/app/api/` (e.g. `src/app/api/schedules/route.ts` for GET/POST `/api/schedules`). Export `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` as needed. Use `requireAuth()` or `requireGroupAccess(request)` from `src/lib/api-helpers.ts` for auth. Group-scoped routes use `requireGroupAccess(request)`, which accepts `?groupId=N` or `?slug=xxx`. For by-id routes, load the resource, then call `hasGroupAccess(userId, resource.groupId)` and return 403 if denied. Return errors with `apiError(message, status, code)`.

- **To change auth for a route:** Edit the route file and swap or add `requireAuth()`, `requireGroupAccess(request)`, or `requireAdmin(request)` from `src/lib/api-helpers.ts`. For group-scoped routes, `requireGroupAccess` resolves group from `?groupId=` or `?slug=` and enforces access. For resource-by-id routes, ensure you load the resource’s `groupId` and call `hasGroupAccess(userId, groupId)` before returning data or mutating.

- **To find the handler for a given path:** Match the path to the table above, or walk the tree: `src/app/api/<segment>/route.ts` for `/api/<segment>`, and `src/app/api/<segment>/[id]/route.ts` for `/api/<segment>/:id`. Dynamic segments are `[slug]`, `[id]`, `[year]`, `[month]`. Cronograma handlers live under `src/app/api/cronograma/`.
