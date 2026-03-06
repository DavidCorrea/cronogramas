# Project overview

This file is the single source for product behaviour, scripts, migrations, and agent rules. **Read "When you begin" and "Workflow" first;** use "Quick reference" and the Features index to find where things live and how they work.

---

# When you begin

- **In a specific folder?** Read its `CONTEXT.md` first (what lives there, where to look next). Prefer that over broad searches.
- **Touching a library we use?** Read the matching skill in **`.cursor/skills/<name>/SKILL.md`** before changing or adding usage. Skills: `next-auth`, `next-intl`, `react`, `tanstack-react-query`, `drizzle-orm`, `zod`, `radix-ui-dialog`, `react-hotkeys-hook`, `googleapis`, `tailwind`, `typescript`.
- **Adding or changing API routes?** See **docs/API.md** (route index, auth, which file to edit).
- **Adding or changing pages or nav?** See **docs/CLIENT.md** (route map, layouts, components).
- **Changing schema or migrations?** See **docs/DATABASE.md** and the "Database and migrations" section below.

**Agent checklist (start of task):** (1) If scoped to a folder, read that folder’s `CONTEXT.md`. (2) If touching auth, i18n, React, TanStack Query, DB, Zod, dialogs, shortcuts, or Google APIs, read the corresponding skill in `.cursor/skills/`. (3) If adding/changing routes, pages, or schema, open the relevant doc (API.md, CLIENT.md, DATABASE.md) so you can update it when done. (4) Plan and explain; get confirmation before making changes.

---

# Quick reference

**Key paths**

| Area | Path |
|------|------|
| Schema | `src/db/schema.ts` |
| Migrations | `src/db/migrations/` (generate with `db:generate`; do not edit SQL or journal by hand) |
| API | `src/app/api/` — index and auth in **docs/API.md** |
| App & components | `src/app/`, `src/components/` — map in **docs/CLIENT.md** |
| Copy (Spanish) | `messages/es.json` — next-intl; client: `useTranslations('namespace')`, `t('key')`, `t('key', { n })` for placeholders |
| Lint | `eslint.config.mjs`; pre-commit: `.husky/pre-commit` (lint-staged) |
| Tests | `spec/` — Jest; describe real scenarios, no technical jargon |
| Cursor rules | `.cursor/rules/` — workflow, lint, API, DB, UI, testing (always-applied + file-scoped) |
| Library skills | `.cursor/skills/` — read before changing usage of listed libraries (see Library skills section) |

**Scripts**

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint; fix in changed files before committing |
| `npm test` / `npm run test:watch` | Tests (TDD for new features) |
| `npm run build` | `drizzle-kit migrate` then `next build` |
| `npm run db:generate` | Generate migration after schema change (descriptive name when prompted) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run seed` | Large realistic seed: 50 users, 35 groups (10 solo, 10 jazz trios, 10 rock bands, 5 orchestras). Slugs from names; random ownership/collaborators; draft/committed schedules; holidays. Pass owner: `npm run seed -- --user=UUID` or `SEED_OWNER_ID=UUID npm run seed`. Optional `--seed=N` for reproducibility. See scripts/CONTEXT.md. |

---

# Domain glossary

Use these terms consistently in schema, API, UI labels, and docs. When the user introduces a domain term and explains it, add it here (see rule `domain-glossary-ask`).

| Term | Meaning |
|------|--------|
| **Event** | Recurring weekday config: one row per weekday in `recurring_events` (type assignable \| for_everyone, label, optional time window). Defines *what* happens on that day of the week; not a calendar date. |
| **Schedule date** | A concrete date in a schedule: one row in `schedule_date` for a given schedule (month/year). Tied to an event for type/label; only assignable schedule dates have assignments. |
| **Assignment** | A member assigned to a role on a specific schedule date: one row in `schedule_date_assignments` (scheduleDateId + roleId + memberId). "Mis asignaciones" = the user's assignments across groups. |

---

# Workflow (mandatory)

1. **Plan:** Split work into units that can be done in parallel when possible; use subagents for parallel work. Get explicit confirmation before making changes; explain what you will do.
2. **Implement:** After a feature, add a new list item under **Features** in this file.
3. **Done = green:** Work is complete only when **`npm run lint`** and **`npm run build`** pass. Fix any failures before finishing (including in files you did not change if they block the build).
4. **Before committing:** Run `npm run lint` on changed files; update **docs/** (API, CLIENT, DATABASE) if you changed routes, pages, or schema; one logical change per commit (one commit per feature when multiple features are requested). Do not commit with `--no-verify`.

**Change → doc update:** New/changed API route → **docs/API.md**. New/changed page, layout, or nav → **docs/CLIENT.md**. Schema or migration → **docs/DATABASE.md** and run `npm run db:generate` then `npm run db:migrate`. New copy → **messages/es.json** (correct namespace). New destructive action → use **ConfirmDialog** and note in danger-zone list if new surface.

**Pre-commit:** The agent cannot run inside the git hook. To reduce failed commits, the user can ask the agent to “run lint and build and fix any issues” before committing. The hook runs lint-staged (ESLint --fix on staged `.js,.ts,.tsx`).

**Pitfalls to avoid:** Do not edit migration `.sql` or `_journal.json` by hand (use `db:generate`). Do not use array index as React key for dynamic lists (use stable id or composite key). Do not skip doc updates when adding routes, pages, or schema. Do not commit with `--no-verify`; fix lint so the hook passes.

---

# Library skills

Project skills in **`.cursor/skills/`** document how each major library is used and how it should be used. **Read the relevant skill before changing or adding usage** of that library so you follow existing patterns and best practices.

**Skills creation and usage (rule `skills-creation-usage`):** When using a **new** library, create a project skill for it in `.cursor/skills/<name>/` and document best practices; add the skill to the list below and in the "When you begin" rule. When using an **existing** library in a new way or adopting a new best practice, **update** that library's skill with the new pattern so future work stays consistent.

**Before using any library in a new use case:** Investigate the proper way to do it (official docs, best practices) and document the approach in that library’s skill file. Update the skill with patterns, gotchas, and “how it should be used” so future work stays consistent.

Skills: `next-auth`, `next-intl`, `react`, `tanstack-react-query`, `drizzle-orm`, `zod`, `radix-ui-dialog`, `react-hotkeys-hook`, `googleapis`, `tailwind`, `typescript`.

---

# Codebase context

- **Context files:** Many directories have a `CONTEXT.md` describing what belongs there and where to look next. When creating a new top-level or domain folder (e.g. under `src/app/api/` or `src/app/`), add a short `CONTEXT.md` with purpose and main entry points (and point to docs/API.md or docs/CLIENT.md if relevant).
- **Keep docs in sync:** When you add or change API routes, pages, or schema, update **docs/API.md**, **docs/CLIENT.md**, or **docs/DATABASE.md** so the next agent has accurate context.

---

# Features

*(Add new items here when you implement a feature.)*

*Feature index (where to look):* Security roadmap → "Security (roadmap)" below. API consistency & validation → "API consistency, security, and validation". Config & BFF → "Config BFF", "View-scoped config", "Server-side group resolution", "Configuration". Schedule model → "Schedule / recurring events", "Schedule generation algorithm", "Schedule generation & preview". Auth & admin → "User authentication", "Admin panel". Calendar export → "Save in Calendar", "Library skills". UX → "Product and UX clarity", "Dashboard, navigation, public view", "Theme (prefers-color-scheme)". Data → "Member management", "Role management", "Holidays", "Multi-group architecture". Seeds / QA → "Large realistic seed (50 users, 35 groups)".

**Large realistic seed (50 users, 35 groups)**
- **Seed script** `scripts/seed.ts`: creates **49 seed users** (fixed IDs, `seed-001@seed.example.com` …) and **35 groups** (idempotent by slug). **10 solo artists:** names inspired by popular Latin artists (slightly altered); slugs derived from name (e.g. `rosalia-vega-cantautora`). **10 jazz trios**, **10 rock bands**, **5 orchestras:** realistic Spanish names, slugs from name. **Ownership:** specified user (passed via `--user=UUID` or `SEED_OWNER_ID`) owns ~30% of groups; rest owned by randomly chosen users from the pool of 50. **Collaborators:** random subset of groups get 1–2 collaborators; specified user is collaborator on at least one group they don't own. **Schedule status:** each schedule (month) randomly draft or committed (~50/50). **Holidays:** ~70% of users get 0–2 user-level holidays; random members get member-level holidays. **Availability:** varied (full week, evenings, weekends, etc.). When the specified user owns a group, they are member "Yo" with reserved assignment slots. Optional `--seed=N` for reproducible randomness. Run: `npm run seed -- --user=<UUID>`. Prerequisites: DATABASE_URL set, migrations applied. See scripts/CONTEXT.md.

## Domain glossary
- **Domain glossary** in AGENTS.md defines **event** (recurring weekday config), **schedule date** (concrete date in a schedule), **assignment** (member–role on a date). Use this vocabulary in schema, API, and UI labels. See also docs/DATABASE.md (glossary reference).

## Library skills
- **Skills creation and usage:** Rule `.cursor/rules/skills-creation-usage.mdc`: create a project skill for each **new** library (best practices in `.cursor/skills/<name>/`); **update** existing skills when using a documented library in a new way or adopting a new best practice. Use create-skill skill for structure. Skills: `next-auth`, `next-intl`, `react`, `tanstack-react-query`, `drizzle-orm`, `zod`, `radix-ui-dialog`, `react-hotkeys-hook`, `googleapis`, `tailwind`, `typescript`.
- **React:** **`.cursor/skills/react/SKILL.md`** — when to use client vs server components, list keys (stable id or composite key; no index for dynamic lists), hooks (useEffect deps and cleanup, useCallback/useMemo), and patterns we use. Use when adding or changing components or hooks.
- **Tailwind:** **`.cursor/skills/tailwind/SKILL.md`** — Tailwind v4 CSS-first config, semantic tokens in `globals.css`, utility-first in components, when to use `@theme` or a shared class. Use when adding or changing styles, layout, or theme.
- **TypeScript:** **`.cursor/skills/typescript/SKILL.md`** — strict mode, interface vs type, path alias `@/*`, avoid `any`, Zod-inferred types. Use when adding or changing types or tsconfig.
- **CONTEXT.md** in key folders (`src/`, `src/app/`, `src/app/api/`, `src/app/api/configuration/`, `src/app/[slug]/config/`, `src/components/`, `src/db/`, `src/lib/`, `spec/`, `docs/`) describe what belongs there and point to docs. Read these before broad searches. New domain or top-level folders get a `CONTEXT.md`. See "Codebase context" above.
## Cursor rules (project conventions)
- **`.cursor/rules/`** contains `.mdc` rules that encode project conventions for the AI: workflow and done criteria, when-you-begin/context, domain-glossary-ask, skills-creation-usage, database and migrations, API conventions, UI/copy/i18n, destructive actions and ConfirmDialog, lint and Git, testing, security (passwords). Always-applied rules: workflow, when-you-begin, lint-and-git, domain-glossary-ask, skills-creation-usage. File-scoped rules apply when matching files are open (see each rule's `globs`). See "Conventions" and "Workflow" in this file for the full text.

- **Guardar en calendario**: On **Mis asignaciones** (`/asignaciones`). Button shown only when (1) user has **canExportCalendars** (set by **admin** in Admin → Usuarios; user cannot change it) and (2) current filter includes at least one assignment from a group with **calendarExportEnabled** (Admin → Grupos). GET `/api/user/assignments/google-calendar` (optional `?groupId=&year=&month=`) → Google OAuth → callback inserts **session user's** assignment dates (never state.userId) into primary Google Calendar. (one all-day event per date, description = "Roles: Role1, Role2"). Only assignments from groups with calendarExportEnabled are included. Redirect to `/asignaciones?calendar=success|error`. Routes: `src/app/api/user/assignments/google-calendar/route.ts`, `src/app/api/auth/callback/google-calendar/route.ts`. Optional legacy flow: public cronograma `.../google-calendar?memberId=` still supported for one member's month (same callback, different state shape).

## Security (roadmap)
- Schedule notes GET: auth + group access required. Group by slug: GET with `?slug=` requires group access (403/404). Google Calendar user-assignments callback uses session user only. Admin bootstrap: random token in cookie (`src/lib/admin-bootstrap-token.ts`), rate limited, Zod body. User search: requires groupId/slug + group access, rate limited. Rate-limit client IP from trusted proxy (docs/API.md).

## View-scoped config data and TanStack Query
- **View-scoped config:** Config list pages request only the slices they need via **useConfigContext(slug, include)** (`src/lib/config-queries.ts`). API **GET /api/configuration/context** accepts optional **`?include=members,roles,days,exclusiveGroups,schedules`**. TanStack Query caches by (slug, include); **refetchContext()** from `useGroup()` invalidates after mutations. Root layout: **QueryProvider** (`src/components/QueryProvider.tsx`). Server: `loadConfigContextForGroup(groupId, { include })` in `src/lib/load-config-context.ts`.

## Server-side group resolution (config layout)
- **Config layout** under `[slug]/config`: group is resolved on the server via `getGroupForConfigLayout(slug)` (auth + slug → group + access check); full config context is loaded with `loadConfigContextForGroup(groupId)`. Server layout passes `initialGroup` and `initialConfigContext` to the client; the client does not fetch "get group by slug" on mount. Fewer round-trips and immediate group/context availability. See **docs/CLIENT.md** (Config layout) and **Config BFF** above.

## Config BFF and cronograma URL
- **Config context (BFF):** Config layout resolves group on the server (`getGroupForConfigLayout(slug)` in `src/lib/config-server.ts`), loads full context via `loadConfigContextForGroup(groupId)` (`src/lib/load-config-context.ts`), and passes `initialGroup` and `initialConfigContext` to the client. The client does not call "get group by slug" on mount; one server-side resolution + one context load. API `GET /api/configuration/context?slug=` (or `?groupId=`) still used for `refetchContext()` after mutations. List pages request only the slices they need via **useConfigContext(slug, include)**; mutations call **refetchContext()** to invalidate. Optional **`?include=members,roles,days,exclusiveGroups,schedules`** for view-scoped payloads. TanStack Query + **QueryProvider**; server: `loadConfigContextForGroup(groupId, { include })`.
- **Cronograma current month:** `/[slug]/cronograma` redirects (302) to `/[slug]/cronograma/[year]/[month]` for current month so bookmarks and links use a single URL shape.

## Schedule / recurring events (core model)
- **Table names**: `schedule_entries` → `schedule_date_assignments`; `schedule_days` → `recurring_events`; `day_role_priorities` → `event_role_priorities`.
- **Weekdays**: Reference table `weekdays` (id, name, display_order), 7 rows (Lunes–Domingo). `recurring_events` and `member_availability` use `weekday_id` FK.
- **Recurring events**: Per-weekday config with `type` (assignable | for_everyone) and optional `label`. Assignable → role slots and scheduler; for_everyone → schedule_date with label only.
- **Member availability**: By weekday (`member_availability.member_id`, `weekday_id`). No FK to recurring_events.
- **Event role priorities**: Only for assignable recurring events (`event_role_priorities.recurring_event_id`). Config UI: "Prioridades de roles por evento" for assignable events only.
- **Schedule generation**: Per date, type/label from recurring_events; only assignable dates run scheduler and get schedule_date_assignments.
- **Event time window**: Assignable events can have `start_time_utc` and `end_time_utc` (HH:MM UTC). Scheduler only assigns members whose availability overlaps that window on that weekday. Config: start/end inputs on event edit form (UTC). Defaults 00:00–23:59.

## API consistency, security, and validation
- **Error shape**: All API errors use `{ error: string, code?: string }` and consistent status codes (400 validation, 403 forbidden, 404 not found, 409 conflict, 429 rate limited). Helper: `apiError(message, status, code)` in `src/lib/api-helpers.ts`.
- **Group access**: Resource-by-id routes (members, schedules, schedule notes, link-check) load the resource's `groupId` and call `hasGroupAccess(userId, groupId)`; 403 if denied. GET schedule notes and GET group by slug require auth and group access. Config routes (roles, priorities, exclusive-groups, days) use `requireGroupAccess(request)` so all are authenticated and accept slug.
- **Slug in group-scoped APIs**: `requireGroupAccess(request)` and `extractGroupIdOrSlug(request)` accept either `?groupId=N` or `?slug=xxx`; slug is resolved to groupId via `resolveGroupBySlug`. Config pages can pass slug from the router.
- **Request validation**: **Zod** schemas in `src/lib/schemas/`; use `parseBody(schema, body)` in handlers for POST/PUT; invalid payloads return 400 with first issue message. Used for roles, exclusive-groups, config holidays, schedule notes (and extensible to more routes).
- **Rate limiting**: Public cronograma GET, admin auth POST, and user search GET are rate limited by IP (in-memory, `src/lib/rate-limit.ts`); 429 when exceeded. Client IP from `x-forwarded-for`/`x-real-ip`; app trusts these when behind a trusted reverse proxy (docs/API.md). For production at scale, consider @upstash/ratelimit (Redis).
- **DELETE by path**: Prefer `DELETE /api/configuration/holidays/[id]` and `DELETE /api/configuration/exclusive-groups/[id]` with group in query (`?groupId=` or `?slug=`). Client uses these paths.

## Stack and setup
- Next.js 16 App Router, TypeScript, Tailwind CSS. **next-intl** for client-facing copy (single locale `es`, messages from `messages/es.json`). Drizzle ORM + PostgreSQL (postgres-js, Neon). Auth.js v5 (next-auth) Google OAuth + Drizzle adapter. **Zod** for request/response validation and shared types. Jest + ts-jest (TDD).
- **Tables**: users, accounts, groups, group_collaborators, members, exclusive_groups, roles, member_roles, weekdays, recurring_events, member_availability, holidays, schedules, schedule_date, schedule_date_assignments, schedule_audit_log, event_role_priorities.

## User authentication
- Google OAuth, JWT session. Users table: Auth.js fields + `isAdmin`, `canCreateGroups`. Accounts: OAuth links.
- Login `/login`, Settings `/settings`. Middleware: session check; redirect to `/login` or 401 for API. Public paths: `/login`, `/api/auth/*`, `/:slug/cronograma/*`, `/api/cronograma/*`, `/admin/*`, `/api/admin/*`.

## Admin panel
- `/admin`: manage users (isAdmin, canCreateGroups, **canExportCalendars** — admin-only, when true user sees "Guardar en calendario" on Mis asignaciones; delete) and **groups** (toggle **Guardar en calendario** per group via `calendarExportEnabled`; **remove group** with ConfirmDialog). Access: `isAdmin === true` or bootstrap when no admin users.
- **Impersonation:** Session-based admins (signed in with Google) can **Ver como** any user from the admin users list. POST `/api/admin/impersonate` (body: `userId`) returns `{ userId }`; client calls `update({ impersonatedUserId })` then redirects to `/`. Nav shows "Actuando como [name]" and "Dejar de suplantar" (stops and redirects). Bootstrap admins cannot impersonate (403). Session stores `realUserId`; `requireAdmin()` uses real user for isAdmin check; all other auth uses effective (impersonated) user. JWT/session in `src/lib/auth.ts`.
- Bootstrap: `/admin/login` with `ADMIN_USERNAME`/`ADMIN_PASSWORD` env; cookie holds a short-lived **random token** (never raw password), validated via `src/lib/admin-bootstrap-token.ts`. Rate limited (strict per IP). Group creation: only `canCreateGroups` or `isAdmin`. API: `GET/PUT/DELETE /api/admin/users`, `GET/PATCH/DELETE /api/admin/groups`, `POST /api/admin/auth`, `POST /api/admin/impersonate`.

## Multi-group architecture
- Multiple groups; each has members, roles, schedules, config. Groups: id, name, slug (unique), owner_id, **calendar_export_enabled** (admin-only; when true, assignments from this group can be exported to Google Calendar from Mis asignaciones). Users: **can_export_calendars** (admin-only; when true, user sees "Guardar en calendario" on Mis asignaciones). Slug in URLs.
- Group creation: `/groups/new` (name, slug, days, roles, collaborators in one form). If no days, defaults seeded (Wed, Fri, Sun active).
- Collaborators: full admin like owner; `/:slug/config/collaborators`. Members: name, optional email, optional `user_id` (link to User). Auto-link when user signs in with member's email.
- Group-scoped tables: members, roles, exclusive_groups, recurring_events, schedules (unique (group_id, month, year)).
- Landing `/`: groups user owns/collaborates/member of, role badges, cross-group assignments + conflict detection, link to create group (if allowed). Config `/:slug/config/*` (owner/collaborator). Public `/:slug/cronograma`, `/:slug/cronograma/:year/:month`. API: admin routes use `groupId` query + auth; public `/api/cronograma/:slug/*`. Group context: `src/lib/group-context.tsx` (GroupProvider, useGroup).

## Holidays
- User-scoped: `/settings`, API `GET/POST/DELETE /api/holidays`. Member-scoped: `/:slug/config/holidays`, API `GET/POST/DELETE /api/configuration/holidays?groupId=N`. Group holidays page shows both (user read-only, member editable). Scheduler: linked members = user + member holidays; unlinked = member only.

## Schedule generation algorithm
- `src/lib/scheduler.ts`, types in `src/lib/scheduler.types.ts`. Input: dates, roles (required counts), members (roles, availability, holidays).
- **Full algorithm description:** **docs/SCHEDULE_ALGORITHM.md** (round-robin, eligibility, priorities, exclusive groups, time window, dependent roles).
- Round-robin with per-day-of-week pointers; event time window filters eligible members; role dependencies = manual selection; exclusive role groups = same member can't get same-exclusive-group roles same date; day role priorities (event_role_priorities) order fill.

## Member management
- Members: group, name, optional email, optional user_id. Linked → user holidays + dashboard. API: `GET/POST /api/members?groupId=N`, `GET/PUT/DELETE /api/members/[id]`. Members list (config context and GET members) uses batched queries: one for members+users, one for all member_roles, one for all member_availability (no N+1).

## Role management
- `/:slug/config/roles`. New role: name, optional member assignments on "Agregar rol". Edit: fields + "Personas con este rol"; "Actualizar" persists. Unsaved changes: UnsavedConfigProvider, config layout guards nav when configDirty. API: `/api/configuration/roles?groupId=N`, `/api/configuration/exclusive-groups?groupId=N`.

## Configuration
- **Config context (BFF):** Config layout resolves group by slug and passes only `initialGroup` to `ConfigLayoutClient`. Config list pages use **useConfigContext(slug, include)** for view-scoped data; mutations call `refetchContext()` to invalidate. API: `GET /api/configuration/context?slug=xxx` (optional `?include=`). Server: `src/lib/config-server.ts`, `src/lib/load-config-context.ts`; client: `src/lib/config-queries.ts`, `src/lib/group-context.tsx`.
- Recurring events: active, type, label per weekday; assignable can set start/end time UTC. Column order: role list reorder, "Guardar orden". Event role priorities: assignable events only. Member availability: 7 weekdays (member_id, weekday_id). API: `/api/configuration/days?groupId=N`, `/api/configuration/priorities?groupId=N`.

## Schedule generation & preview
- `/:slug/config/schedules`. One row per date in `schedule_date` (type assignable | for_everyone, label, note). Assignments in schedule_date_assignments. Add/remove date; notes in Editar modal; times in UTC in DB, shown/edited in user TZ. Rebuild from today: Overwrite or Fill empty, with preview. Audit log: "Historial de cambios". API: `/api/schedules?groupId=N`, `/api/schedules/[id]`, `/api/schedules/[id]/notes`.

## Dashboard, navigation, public view
- **Dashboard**: `/`, cross-group assignments, conflicts (same date and overlapping time windows in different groups). API `GET /api/user/dashboard`. Assignments loaded via `getAssignments()` in `src/lib/user-assignments.ts` with batched role lookup (no N+1). Conflict detection in `src/lib/dashboard-conflicts.ts` (`buildConflicts`).
- **Time-aware dashboard conflicts:** Dashboard and Mis asignaciones only show a conflict when the user has two or more assignments on the same date in different groups whose time ranges overlap (HH:MM from `schedule_date`). Non-overlapping same-day assignments (e.g. morning in one group, evening in another) are not conflicts. Logic: `rangesOverlap` and `buildConflicts` in `src/lib/dashboard-conflicts.ts`; specs in `spec/dashboard-conflicts.spec.ts`.
- **Theme (prefers-color-scheme):** First-time visitors get system preference without flash. Inline script in root layout (`src/app/layout.tsx`) runs before first paint and sets `document.documentElement` class and `color-scheme` from `localStorage` (key `band-scheduler-theme`) or `matchMedia("(prefers-color-scheme: dark)")`. AppNavBar uses **`src/lib/theme.ts`** store with `useSyncExternalStore`; sun/moon pill toggle updates DOM, localStorage, and notifies listeners. CSS variables in **`src/app/globals.css`**: light mode (light gray bg, white cards, purple accent `#7f5df4`), dark mode (near-black bg `#1a1a1a`, elevated cards `#2c2c2c`, accent `#8b6cf7`). Responsive, card-based layout; primary actions use accent colour.
- **Nav**: AppNavBar (root layout): Cronogramas, Inicio, Mis asignaciones (when signed in), Ajustes, auth. GroupSubNav (config layout): group name, "Ir a…" quick jump (⌘K), Miembros, Roles, Configuración, Vacaciones, Colaboradores, Cronograma.
- **Public view**: `/:slug/cronograma` redirects (302) to `/:slug/cronograma/:year/:month` for current month; `/:slug/cronograma/:year/:month` is the canonical schedule view. API `/api/cronograma/:slug`, `/api/cronograma/:slug/:year/:month`. "Guardar en calendario" for **my assignments** lives on **Mis asignaciones** (see below). **SharedScheduleView** is split into `src/components/SharedScheduleView/` (index, types, MonthHeader, DateDetailModal with Radix Dialog, WeekSection, CalendarGrid); same public API.

## Product and UX clarity
- **One schedule mental model**: Copy and nav treat "schedule" as one entity per group with months as views. Config nav label "Cronograma"; schedules page "Meses del cronograma"; config home "Ver cronograma" and "Cronograma" card.
- **My assignments**: Page `/asignaciones` lists the user's assignments across groups with filters (group, month, role). Uses `GET /api/user/dashboard`. **Guardar en Google Calendar**: button shown only when (1) user has **canExportCalendars** (set by admin in Admin → Usuarios) and (2) current filter includes at least one assignment from a group with **calendarExportEnabled**. Click starts OAuth; callback adds those assignments to primary Google Calendar (one event per date, description = roles). Redirect to `/asignaciones?calendar=success|error`. Auth required.
- **Consistent back/cancel**: Shared `BackLink` component (top of page) on member/role/event/schedule form and detail pages; "Cancelar" / "Volver" at bottom of forms returns to list. Keys: `common.back`, `members.backToMembers`, `roles.backToRoles`, `events.backToEvents`, `scheduleDetail.backToScheduleList`.
- **Keyboard shortcuts**: `react-hotkeys-hook`. **?** opens help overlay (shortcuts list). **g** then **h** → Inicio, **g** then **a** → Mis asignaciones. In config: **⌘K** (or Ctrl+K) opens "Ir a…" search. Component: `src/components/KeyboardShortcuts.tsx`.
- **Danger zones and destructive confirmations**: Views where a resource can be deleted have a **"Zona de peligro"** section at the bottom (bordered, destructive tint; title/description from `common.dangerZone` / `common.dangerZoneDescription` or page-specific keys). Delete (or remove) actions live inside that section or are clearly tied to it. Every destructive action uses **ConfirmDialog** (`src/components/ConfirmDialog.tsx`, **@radix-ui/react-dialog**) for focus trap, aria-modal, and keyboard; no `window.confirm()`. Applied to: member edit, role edit, event edit (EventForm), schedule-detail delete schedule and delete date, collaborators, group holidays, user holidays (settings), exclusive groups (roles list), admin delete user, **admin delete group**. Shared **DangerZone** component: `src/components/DangerZone.tsx`.
- **Quick jump (config)**: "Ir a…" in GroupSubNav + ⌘K: search by name over members, roles, events, schedule months; select to navigate. Data from `configContext`. Component: `src/components/ConfigGoTo.tsx`.
- **Loading, errors, and empty states**: **Skeletons** (`src/components/Skeletons/`): SkeletonCard, SkeletonRow, SkeletonText, SkeletonGrid, SkeletonRegion (aria-busy/aria-label). **Route-level loading:** `loading.tsx` for `/`, `[slug]/config`, `[slug]/cronograma/[year]/[month]`. **Error boundaries:** `error.tsx` at root, config, and cronograma with "Reintentar" and "Volver". **Empty states:** `EmptyState` component on members, roles, events, schedules when list is empty (message + primary CTA). **Unsaved config:** `UnsavedBanner` when dirty ("Tienes cambios sin guardar"); `beforeunload` on tab close. See docs/IMPROVEMENT_ROADMAP.md §2.

## Locale, seeds, env
- UI in Spanish. App name **Cronogramas**.
- **Copy:** Client-facing text in **`messages/es.json`**. The app uses **next-intl**: client components use `useTranslations('namespace')` and `t('key')` (or `t('key', { n: value })` for placeholders).
- **Seeds**: weekdays (7 rows in migration). Recurring events per group on creation if no days (Wed, Fri, Sun active). No default roles.
- **Env**: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`), `AUTH_TRUST_HOST=true`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

---

# Conventions

*(Canonical source for project conventions. The same conventions are reflected in `.cursor/rules/` so the AI applies them in Cursor; update both if you change something here.)*

**UI** — Mobile-first. All user-facing text in **Spanish**. Copy lives in **`messages/es.json`**; use next-intl: `useTranslations('namespace')` and `t('key')` in components.

**Code style** — Clean code. No changes without confirmation; explain changes first.

**Testing** — Jest in `spec/`. TDD for new features. Test descriptions = real scenarios, no technical terms.

**Security** — Passwords: never plain text. Store with **bcrypt**, unique random salt (stored with hash). Verify by hashing attempt with stored salt and comparing.

**Database and migrations** — **drizzle-kit only**. Do not create or edit migration `.sql` or `src/db/migrations/meta/_journal.json` by hand (except documented one-off recovery).
- **Workflow**: (1) Edit `src/db/schema.ts` → (2) `npm run db:generate` (descriptive name) → (3) `npm run db:migrate`. Applied migrations: `drizzle.__drizzle_migrations` (always use schema name in queries).
- **After a migration reset** (meta + migrations recreated, baseline no-op): in each env run `TRUNCATE drizzle.__drizzle_migrations;` then `npm run db:migrate`.
- **Applying**: Local `npm run db:migrate` (needs DATABASE_URL). Deploy: `npm run build` runs migrate then next build; set DATABASE_URL in Vercel.
- **Config**: `drizzle.config.ts` uses `drizzle.__drizzle_migrations`. Checking applied: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;` (journal `when` = when generated, not applied).
- **Migration recorded but DB unchanged**: Run that migration's SQL manually if needed.
- **Fix to already-applied migration file**: DB stores file hash. No Drizzle amend. If SQL applied manually and row must sync, INSERT once per env; else leave as-is.
- Non-schema changes (e.g. backfill): document in this file or `scripts/`, then run `db:generate` after any schema change so snapshots stay in sync.

**Linting** — ESLint: `eslint.config.mjs` (Next.js + TypeScript). `npm run lint` for full run; `eslint --fix` auto-fixes. Pre-commit: Husky runs lint-staged; only staged `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx` are linted. Failed lint aborts commit. Do not introduce new lint errors; fix or suppress only with explicit justification.

**Git** — Commits: only related changes (one feature/task per commit). Multiple features requested → one commit per feature. Do not commit with `--no-verify`; fix lint (and any other pre-commit checks) so the hook passes.
