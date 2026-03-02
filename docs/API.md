# API Reference

## 1. Overview

All API routes are **Next.js App Router route handlers** under `src/app/api`. Routes are organized by domain (auth, admin, groups, members, schedules, configuration, cronograma, user, holidays). **Auth**: most routes require a **session** (Auth.js via `requireAuth()` or `requireGroupAccess()` in `src/lib/api-helpers.ts`); **Admin** routes use `requireAdmin()` (session `isAdmin` or bootstrap Basic Auth/cookie when no admin users exist). **Public** routes are `/api/cronograma/[slug]` and `/api/cronograma/[slug]/[year]/[month]` (no auth; group identified by path `:slug`). Group-scoped routes that are not path-based use the query parameter **`groupId`**; cronograma routes use the path segment **`:slug`** (group slug).

---

## 2. Route index

### Auth
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET, POST | `/api/auth/[...nextauth]` | Auth.js session (sign-in, callback, session) | `src/app/api/auth/[...nextauth]/route.ts` |

### Admin
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| POST | `/api/admin/auth` | Bootstrap admin auth (set cookie when no admin users); validates ADMIN_USERNAME/ADMIN_PASSWORD | `src/app/api/admin/auth/route.ts` |
| GET | `/api/admin/users` | List all users (admin only) | `src/app/api/admin/users/route.ts` |
| PUT | `/api/admin/users` | Update user (isAdmin, canCreateGroups) | `src/app/api/admin/users/route.ts` |
| DELETE | `/api/admin/users` | Delete user by `id` query param | `src/app/api/admin/users/route.ts` |

### Groups
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/groups` | List groups for current user, or get one by `?slug=` | `src/app/api/groups/route.ts` |
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
| GET | `/api/schedules/[id]/notes` | Get date notes for schedule (no auth) | `src/app/api/schedules/[id]/notes/route.ts` |
| POST | `/api/schedules/[id]/notes` | Save note for a date | `src/app/api/schedules/[id]/notes/route.ts` |
| DELETE | `/api/schedules/[id]/notes` | Delete note for a date (`?date=`) | `src/app/api/schedules/[id]/notes/route.ts` |

### Configuration (days, roles, priorities, exclusive-groups, holidays)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
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
| GET | `/api/configuration/exclusive-groups` | List exclusive groups for group (`?groupId=`) | `src/app/api/configuration/exclusive-groups/route.ts` |
| POST | `/api/configuration/exclusive-groups` | Create exclusive group | `src/app/api/configuration/exclusive-groups/route.ts` |
| DELETE | `/api/configuration/exclusive-groups` | Delete exclusive group (`?id=`) | `src/app/api/configuration/exclusive-groups/route.ts` |
| GET | `/api/configuration/holidays` | List member holidays for group | `src/app/api/configuration/holidays/route.ts` |
| POST | `/api/configuration/holidays` | Create member holiday | `src/app/api/configuration/holidays/route.ts` |
| DELETE | `/api/configuration/holidays` | Delete member holiday | `src/app/api/configuration/holidays/route.ts` |

### Cronograma (public)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/cronograma/[slug]` | Public schedule for group by slug (current or latest committed) | `src/app/api/cronograma/[slug]/route.ts` |
| GET | `/api/cronograma/[slug]/[year]/[month]` | Public schedule for group by slug, year, month | `src/app/api/cronograma/[slug]/[year]/[month]/route.ts` |

### User (dashboard, search)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/user/dashboard` | Dashboard data: user's assignments and conflicts | `src/app/api/user/dashboard/route.ts` |
| GET | `/api/users/search` | Search users by name/email (`?q=`) for linking/invites | `src/app/api/users/search/route.ts` |

### Holidays (user-scoped)
| Method(s) | Path | Purpose | File |
|-----------|------|---------|------|
| GET | `/api/holidays` | List current user's holidays | `src/app/api/holidays/route.ts` |
| POST | `/api/holidays` | Create user holiday (startDate, endDate, description) | `src/app/api/holidays/route.ts` |
| DELETE | `/api/holidays` | Delete user holiday (`?id=`) | `src/app/api/holidays/route.ts` |

---

## 3. Per-domain summary

- **Auth** — NextAuth.js catch-all: `GET`/`POST` for sign-in, callback, session. Handlers from `src/lib/auth.ts`. Session required for all other authenticated routes.

- **Admin** — Bootstrap and user management. **Auth**: `requireAdmin()` (session with `isAdmin`, or when no admin users: Basic Auth / `ADMIN_USERNAME`+`ADMIN_PASSWORD`, or cookie set by `POST /api/admin/auth`). No `groupId`; operates on global users.

- **Groups** — List/create groups and manage collaborators. **Auth**: `requireAuth()` for list/create; `requireAuth()` + `hasGroupAccess(userId, groupId)` for `[id]/collaborators`. Path param `[id]` is group id. Helpers: `src/lib/api-helpers.ts`.

- **Members** — CRUD for group members (and link-check). **Auth**: `requireGroupAccess(request)` for list/create (uses `?groupId=`); `requireAuth()` for `[id]` and link-check (resource-level; no explicit group check). File: `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`, `src/app/api/members/[id]/link-check/route.ts`.

- **Schedules** — Schedules and date notes. **Auth**: `requireGroupAccess(request)` for list/create (uses `?groupId=`); `requireAuth()` for `[id]` and notes (resource by schedule id). GET notes is unauthenticated. Helpers: `src/lib/schedule-helpers.ts`, `src/lib/scheduler.ts`, `src/lib/audit-log.ts`.

- **Configuration** — Days (recurring events), roles, priorities, exclusive-groups, group-scoped holidays. **Auth**: Days and configuration/holidays use `requireGroupAccess(request)` for mutations and some GETs; GET for days uses only `extractGroupId(request)`. Roles, priorities, and exclusive-groups use only `extractGroupId(request)` (no auth in route). All expect `?groupId=` except nested `[id]` routes that get group from the resource. Types/schema: `src/db/schema.ts`.

- **Cronograma** — Public read-only schedule by group slug. **Auth**: None. Group from path `[slug]` via `resolveGroupBySlug(slug)` in `src/lib/group.ts`. Response built with `src/lib/public-schedule.ts`.

- **User** — Dashboard and user search. **Auth**: `requireAuth()`. Dashboard uses members/schedules/roles; search queries `users` by name/email.

- **Holidays** — User-level holidays (unavailability). **Auth**: `requireAuth()`. Scoped by `userId` from session; DELETE checks `existing.userId === authResult.user.id`.

---

## 4. Where to look

- **To add a new endpoint:** Add a `route.ts` under the right segment in `src/app/api/` (e.g. `src/app/api/schedules/route.ts` for GET/POST `/api/schedules`). Export `GET`, `POST`, `PUT`, `PATCH`, or `DELETE` as needed. Use `requireAuth()` or `requireGroupAccess(request)` from `src/lib/api-helpers.ts` for auth; use `extractGroupId(request)` when the route is group-scoped by query param.

- **To change auth for a route:** Edit the route file and swap or add `requireAuth()`, `requireGroupAccess(request)`, or `requireAdmin(request)` from `src/lib/api-helpers.ts`. For group-scoped routes, ensure `groupId` comes from query (e.g. `extractGroupId`) or from the resource (e.g. schedule/member) and that access is checked via `requireGroupAccess` or `hasGroupAccess`.

- **To find the handler for a given path:** Match the path to the table above, or walk the tree: `src/app/api/<segment>/route.ts` for `/api/<segment>`, and `src/app/api/<segment>/[id]/route.ts` for `/api/<segment>/:id`. Dynamic segments are `[slug]`, `[id]`, `[year]`, `[month]`. Cronograma handlers live under `src/app/api/cronograma/`.
