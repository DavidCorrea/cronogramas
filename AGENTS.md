# Project overview
This file is the single source for product behaviour, scripts, migrations, and agent rules. Features and domain context are inlined below.

# Quick reference (for the agent)

**Key paths**
- Schema: `src/db/schema.ts` — migrations: `src/db/migrations/` (generate with `db:generate`, never edit SQL/journal by hand).
- API routes: `src/app/api/` — index and auth: **docs/API.md**.
- Pages/components: `src/app/`, `src/components/` — route map and nav: **docs/CLIENT.md**.
- Client-facing copy: **`messages/es.json`** — buttons, labels, headings, messages (Spanish). The app uses **next-intl**; in client components use **`useTranslations('namespace')`** and **`t('key')`** (or **`t('key', { n: value })`** for placeholders).
- Lint: `eslint.config.mjs` — pre-commit: `.husky/pre-commit` (runs lint-staged).
- Tests: `spec/` — Jest; describe real scenarios, no technical jargon.

**Navigating the codebase**
- **Read `context.md` first** when entering a folder: many directories have a `context.md` describing what belongs there and where to look next. Prefer reading these before running broad searches so navigation is more efficient.
- **Create `context.md` in new folders**: When adding a new top-level or domain folder (e.g. under `src/app/api/` or `src/app/`), add a short `context.md` in that folder describing its purpose and main entry points (and point to docs/API.md or docs/CLIENT.md if relevant).

**Scripts**
- `npm run dev` — Dev server
- `npm run lint` — ESLint on codebase; fix in changed files before committing
- `npm test` — Run tests (TDD for new features)
- `npm run test:watch` — Tests in watch mode
- `npm run build` — Runs `drizzle-kit migrate` then `next build`
- `npm run db:generate` — Generate migration after schema changes (descriptive name when prompted)
- `npm run db:migrate` — Apply pending migrations
- `npm run db:studio` — Drizzle Studio

# Codebase context (where to look)
- **Context files**: Before searching the codebase, check for a `context.md` in the relevant folder; it summarizes what lives there and points to the right docs or files. When creating new folders that represent a distinct area (e.g. a new API domain or feature area), add a `context.md` so future traversal stays easy.
- **API** — **docs/API.md**: route index by domain, auth (requireAuth / requireGroupAccess / cronograma public), which file to edit. Update that doc when adding or changing routes.
- **Client** — **docs/CLIENT.md**: route map (pages by path), layouts, key components, shared lib. Update when adding pages or nav.
- **Database** — **docs/DATABASE.md**: tables and relations, migration workflow. Update when changing schema.
- **Keep docs in sync:** After changing API, client, or schema, update the corresponding doc so the next agent has accurate context.

# How to work
- Split requests into units that can be done in parallel when possible; use subagents for parallel work.
- Get explicit confirmation before making changes; explain what you will do.
- **Consider work complete only when the linter passes and the build has no errors:** run `npm run lint` and `npm run build`; fix any lint or build failures before finishing (including in files you did not change, if they block the build).
- After implementing a feature: add a new list item under **Features** in this file.

# Before committing
- Run **`npm run lint`** and fix any errors in the files you changed (pre-commit runs lint-staged on staged files).
- Ensure **docs/** (API, CLIENT, DATABASE) are updated if you changed routes, pages, or schema.
- One logical change per commit; one commit per feature when multiple features are requested.

---

# Features
*(Add new items here when you implement a feature.)*

## Context files for navigation
- **context.md** in key folders (`src/`, `src/app/`, `src/app/api/`, `src/app/api/configuration/`, `src/app/[slug]/config/`, `src/components/`, `src/db/`, `src/lib/`, `spec/`, `docs/`) describe what belongs there and point to docs. Agents should read these before broad searches. New domain or top-level folders should get a `context.md`. See AGENTS.md "Navigating the codebase" and "Codebase context".

## Save in Calendar (Mis asignaciones)
- **Guardar en calendario**: On **Mis asignaciones** (`/asignaciones`). Button shown only when (1) user has **canExportCalendars** (set by **admin** in Admin → Usuarios; user cannot change it) and (2) current filter includes at least one assignment from a group with **calendarExportEnabled** (Admin → Grupos). GET `/api/user/assignments/google-calendar` (optional `?groupId=&year=&month=`) → Google OAuth → callback inserts current user's assignment dates into primary Google Calendar (one all-day event per date, description = "Roles: Role1, Role2"). Only assignments from groups with calendarExportEnabled are included. Redirect to `/asignaciones?calendar=success|error`. Routes: `src/app/api/user/assignments/google-calendar/route.ts`, `src/app/api/auth/callback/google-calendar/route.ts`. Optional legacy flow: public cronograma `.../google-calendar?memberId=` still supported for one member's month (same callback, different state shape).

## View-scoped config data and TanStack Query
- **View-scoped config:** Config list pages request only the slices they need via **useConfigContext(slug, include)** (`src/lib/config-queries.ts`). API **GET /api/configuration/context** accepts optional **`?include=members,roles,days,exclusiveGroups,schedules`**. TanStack Query caches by (slug, include); **refetchContext()** from `useGroup()` invalidates after mutations. Root layout: **QueryProvider** (`src/components/QueryProvider.tsx`). Server: `loadConfigContextForGroup(groupId, { include })` in `src/lib/load-config-context.ts`.

## Server-side group resolution (config layout)
- **Config layout** under `[slug]/config`: group is resolved on the server via `getGroupForConfigLayout(slug)` (auth + slug → group + access check); full config context is loaded with `loadConfigContextForGroup(groupId)`. Server layout passes `initialGroup` and `initialConfigContext` to the client; the client does not fetch “get group by slug” on mount. Fewer round-trips and immediate group/context availability. See **docs/CLIENT.md** (Config layout) and **Config BFF** above.

## Config BFF and cronograma URL
- **Config context (BFF):** Config layout resolves group on the server (`getGroupForConfigLayout(slug)` in `src/lib/config-server.ts`), loads full context via `loadConfigContextForGroup(groupId)` (`src/lib/load-config-context.ts`), and passes `initialGroup` and `initialConfigContext` to the client. The client does not call “get group by slug” on mount; one server-side resolution + one context load. API `GET /api/configuration/context?slug=` (or `?groupId=`) still used for `refetchContext()` after mutations. List pages request only the slices they need via **useConfigContext(slug, include)**; mutations call **refetchContext()** to invalidate. Optional **`?include=members,roles,days,exclusiveGroups,schedules`** for view-scoped payloads. TanStack Query + **QueryProvider**; server: `loadConfigContextForGroup(groupId, { include })`.
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
- **Group access**: Resource-by-id routes (members, schedules, schedule notes, link-check) load the resource’s `groupId` and call `hasGroupAccess(userId, groupId)`; 403 if denied. Config routes (roles, priorities, exclusive-groups, days) use `requireGroupAccess(request)` so all are authenticated and accept slug.
- **Slug in group-scoped APIs**: `requireGroupAccess(request)` and `extractGroupIdOrSlug(request)` accept either `?groupId=N` or `?slug=xxx`; slug is resolved to groupId via `resolveGroupBySlug`. Config pages can pass slug from the router.
- **Request validation**: **Zod** schemas in `src/lib/schemas/`; use `parseBody(schema, body)` in handlers for POST/PUT; invalid payloads return 400 with first issue message. Used for roles, exclusive-groups, config holidays, schedule notes (and extensible to more routes).
- **Rate limiting**: Public cronograma GET endpoints are rate limited by IP (in-memory, `src/lib/rate-limit.ts`); 429 when exceeded. For production at scale, consider @upstash/ratelimit (Redis).
- **DELETE by path**: Prefer `DELETE /api/configuration/holidays/[id]` and `DELETE /api/configuration/exclusive-groups/[id]` with group in query (`?groupId=` or `?slug=`). Client uses these paths.

## Stack and setup
- Next.js 16 App Router, TypeScript, Tailwind CSS. **next-intl** for client-facing copy (single locale `es`, messages from `messages/es.json`). Drizzle ORM + PostgreSQL (postgres-js, Neon). Auth.js v5 (next-auth) Google OAuth + Drizzle adapter. **Zod** for request/response validation and shared types. Jest + ts-jest (TDD).
- **Tables**: users, accounts, groups, group_collaborators, members, exclusive_groups, roles, member_roles, weekdays, recurring_events, member_availability, holidays, schedules, schedule_date, schedule_date_assignments, schedule_audit_log, event_role_priorities.

## User authentication
- Google OAuth, JWT session. Users table: Auth.js fields + `isAdmin`, `canCreateGroups`. Accounts: OAuth links.
- Login `/login`, Settings `/settings`. Middleware: session check; redirect to `/login` or 401 for API. Public paths: `/login`, `/api/auth/*`, `/:slug/cronograma/*`, `/api/cronograma/*`, `/admin/*`, `/api/admin/*`.

## Admin panel
- `/admin`: manage users (isAdmin, canCreateGroups, **canExportCalendars** — admin-only, when true user sees "Guardar en calendario" on Mis asignaciones; delete) and **groups** (toggle **Guardar en calendario** per group via `calendarExportEnabled`). Access: `isAdmin === true` or bootstrap when no admin users.
- Bootstrap: `/admin/login` with `ADMIN_USERNAME`/`ADMIN_PASSWORD` env, short-lived cookie. Group creation: only `canCreateGroups` or `isAdmin`. API: `GET/PUT/DELETE /api/admin/users`, `GET/PATCH /api/admin/groups`, `POST /api/admin/auth`.

## Multi-group architecture
- Multiple groups; each has members, roles, schedules, config. Groups: id, name, slug (unique), owner_id, **calendar_export_enabled** (admin-only; when true, assignments from this group can be exported to Google Calendar from Mis asignaciones). Users: **can_export_calendars** (admin-only; when true, user sees "Guardar en calendario" on Mis asignaciones). Slug in URLs.
- Group creation: `/groups/new` (name, slug, days, roles, collaborators in one form). If no days, defaults seeded (Wed, Fri, Sun active).
- Collaborators: full admin like owner; `/:slug/config/collaborators`. Members: name, optional email, optional `user_id` (link to User). Auto-link when user signs in with member’s email.
- Group-scoped tables: members, roles, exclusive_groups, recurring_events, schedules (unique (group_id, month, year)).
- Landing `/`: groups user owns/collaborates/member of, role badges, cross-group assignments + conflict detection, link to create group (if allowed). Config `/:slug/config/*` (owner/collaborator). Public `/:slug/cronograma`, `/:slug/cronograma/:year/:month`. API: admin routes use `groupId` query + auth; public `/api/cronograma/:slug/*`. Group context: `src/lib/group-context.tsx` (GroupProvider, useGroup).

## Holidays
- User-scoped: `/settings`, API `GET/POST/DELETE /api/holidays`. Member-scoped: `/:slug/config/holidays`, API `GET/POST/DELETE /api/configuration/holidays?groupId=N`. Group holidays page shows both (user read-only, member editable). Scheduler: linked members = user + member holidays; unlinked = member only.

## Schedule generation algorithm
- `src/lib/scheduler.ts`, types in `src/lib/scheduler.types.ts`. Input: dates, roles (required counts), members (roles, availability, holidays).
- Round-robin with per-day-of-week pointers; event time window filters eligible members; role dependencies = manual selection; exclusive role groups = same member can’t get same-exclusive-group roles same date; day role priorities (event_role_priorities) order fill.

## Member management
- Members: group, name, optional email, optional user_id. Linked → user holidays + dashboard. API: `GET/POST /api/members?groupId=N`, `GET/PUT/DELETE /api/members/[id]`.

## Role management
- `/:slug/config/roles`. New role: name, optional member assignments on "Agregar rol". Edit: fields + "Personas con este rol"; "Actualizar" persists. Unsaved changes: UnsavedConfigProvider, config layout guards nav when configDirty. API: `/api/configuration/roles?groupId=N`, `/api/configuration/exclusive-groups?groupId=N`.

## Configuration
- **Config context (BFF):** Config layout resolves group by slug and passes only `initialGroup` to `ConfigLayoutClient`. Config list pages use **useConfigContext(slug, include)** for view-scoped data; mutations call `refetchContext()` to invalidate. API: `GET /api/configuration/context?slug=xxx` (optional `?include=`). Server: `src/lib/config-server.ts`, `src/lib/load-config-context.ts`; client: `src/lib/config-queries.ts`, `src/lib/group-context.tsx`.
- Recurring events: active, type, label per weekday; assignable can set start/end time UTC. Column order: role list reorder, "Guardar orden". Event role priorities: assignable events only. Member availability: 7 weekdays (member_id, weekday_id). API: `/api/configuration/days?groupId=N`, `/api/configuration/priorities?groupId=N`.

## Schedule generation & preview
- `/:slug/config/schedules`. One row per date in `schedule_date` (type assignable | for_everyone, label, note). Assignments in schedule_date_assignments. Add/remove date; notes in Editar modal; times in UTC in DB, shown/edited in user TZ. Rebuild from today: Overwrite or Fill empty, with preview. Audit log: "Historial de cambios". API: `/api/schedules?groupId=N`, `/api/schedules/[id]`, `/api/schedules/[id]/notes`.

## Dashboard, navigation, public view
- **Dashboard**: `/`, cross-group assignments, conflicts (same date multiple groups). API `GET /api/user/dashboard`.
- **Nav**: AppNavBar (root layout): Cronogramas, Inicio, Mis asignaciones (when signed in), Ajustes, auth. GroupSubNav (config layout): group name, "Ir a…" quick jump (⌘K), Miembros, Roles, Configuración, Vacaciones, Colaboradores, Cronograma.
- **Public view**: `/:slug/cronograma` redirects (302) to `/:slug/cronograma/:year/:month` for current month; `/:slug/cronograma/:year/:month` is the canonical schedule view. API `/api/cronograma/:slug`, `/api/cronograma/:slug/:year/:month`. "Guardar en calendario" for **my assignments** lives on **Mis asignaciones** (see below).

## Product and UX clarity
- **One schedule mental model**: Copy and nav treat "schedule" as one entity per group with months as views. Config nav label "Cronograma"; schedules page "Meses del cronograma"; config home "Ver cronograma" and "Cronograma" card.
- **My assignments**: Page `/asignaciones` lists the user's assignments across groups with filters (group, month, role). Uses `GET /api/user/dashboard`. **Guardar en Google Calendar**: button shown only when (1) user has **canExportCalendars** (set by admin in Admin → Usuarios) and (2) current filter includes at least one assignment from a group with **calendarExportEnabled**. Click starts OAuth; callback adds those assignments to primary Google Calendar (one event per date, description = roles). Redirect to `/asignaciones?calendar=success|error`. Auth required.
- **Consistent back/cancel**: Shared `BackLink` component (top of page) on member/role/event/schedule form and detail pages; "Cancelar" / "Volver" at bottom of forms returns to list. Keys: `common.back`, `members.backToMembers`, `roles.backToRoles`, `events.backToEvents`, `scheduleDetail.backToScheduleList`.
- **Keyboard shortcuts**: `react-hotkeys-hook`. **?** opens help overlay (shortcuts list). **g** then **h** → Inicio, **g** then **a** → Mis asignaciones. In config: **⌘K** (or Ctrl+K) opens "Ir a…" search. Component: `src/components/KeyboardShortcuts.tsx`.
- **Danger zones and destructive confirmations**: Views where a resource can be deleted have a **"Zona de peligro"** section at the bottom (bordered, destructive tint; title/description from `common.dangerZone` / `common.dangerZoneDescription` or page-specific keys). Delete (or remove) actions live inside that section or are clearly tied to it. Every destructive action uses **ConfirmDialog** (`src/components/ConfirmDialog.tsx`, **@radix-ui/react-dialog**) for focus trap, aria-modal, and keyboard; no `window.confirm()`. Applied to: member edit, role edit, event edit (EventForm), schedules list and schedule-detail delete date, collaborators, group holidays, user holidays (settings), exclusive groups (roles list), admin delete user. Shared **DangerZone** component: `src/components/DangerZone.tsx`.
- **Quick jump (config)**: "Ir a…" in GroupSubNav + ⌘K: search by name over members, roles, events, schedule months; select to navigate. Data from `configContext`. Component: `src/components/ConfigGoTo.tsx`.
- **Loading, errors, and empty states**: **Skeletons** (`src/components/Skeletons/`): SkeletonCard, SkeletonRow, SkeletonText, SkeletonGrid, SkeletonRegion (aria-busy/aria-label). **Route-level loading:** `loading.tsx` for `/`, `[slug]/config`, `[slug]/cronograma/[year]/[month]`. **Error boundaries:** `error.tsx` at root, config, and cronograma with "Reintentar" and "Volver". **Empty states:** `EmptyState` component on members, roles, events, schedules when list is empty (message + primary CTA). **Unsaved config:** `UnsavedBanner` when dirty ("Tienes cambios sin guardar"); `beforeunload` on tab close. See docs/IMPROVEMENT_ROADMAP.md §2.

## Locale, seeds, env
- UI in Spanish. App name **Cronogramas**.
- **Copy:** Client-facing text in **`messages/es.json`**. The app uses **next-intl**: client components use `useTranslations('namespace')` and `t('key')` (or `t('key', { n: value })` for placeholders).
- **Seeds**: weekdays (7 rows in migration). Recurring events per group on creation if no days (Wed/Fri/Sun, assignable). No default roles.
- **Env**: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `AUTH_TRUST_HOST=true`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

---

# UI
- Mobile-first. All user-facing text in **Spanish**.
- **Copy:** Client-facing wordings live in **`messages/es.json`**. Use **next-intl**: `useTranslations('namespace')` and `t('key')` in components.

# Code style
- Clean code. No changes without Prompter confirmation; explain changes first.

# Testing
- **Jest** in `spec/`. TDD for new features. Test descriptions = real scenarios, no technical terms.

# Security
- Passwords: never plain text. Store with **bcrypt**, unique random salt (stored with hash). Verify by hashing attempt with stored salt and comparing.

# Database and migrations
- **drizzle-kit only**. Do not create or edit migration `.sql` or `src/db/migrations/meta/_journal.json` by hand (except documented one-off recovery).
- **Workflow**: (1) Edit `src/db/schema.ts` → (2) `npm run db:generate` (descriptive name) → (3) `npm run db:migrate`. Applied migrations: `drizzle.__drizzle_migrations` (always use schema name in queries).
- **After a migration reset** (meta + migrations recreated, baseline no-op): in each env run `TRUNCATE drizzle.__drizzle_migrations;` then `npm run db:migrate`.
- **Applying**: Local `npm run db:migrate` (needs DATABASE_URL). Deploy: `npm run build` runs migrate then next build; set DATABASE_URL in Vercel.
- **Config**: `drizzle.config.ts` uses `drizzle.__drizzle_migrations`. Checking applied: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;` (journal `when` = when generated, not applied).
- **Migration recorded but DB unchanged**: Run that migration’s SQL manually if needed.
- **Fix to already-applied migration file**: DB stores file hash. No Drizzle amend. If SQL applied manually and row must sync, INSERT once per env; else leave as-is.
- Non-schema changes (e.g. backfill): document in this file or `scripts/`, then run `db:generate` after any schema change so snapshots stay in sync.

# Linting
- **ESLint**: `eslint.config.mjs` (Next.js + TypeScript). `npm run lint` for full run; `eslint --fix` auto-fixes. Pre-commit: Husky runs lint-staged; only staged `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx` are linted. Failed lint aborts commit. Do not introduce new lint errors; fix or suppress only with explicit justification.

# Git
- Commits: only related changes (one feature/task per commit). Multiple features requested → one commit per feature.
- Do not commit with `--no-verify`; fix lint (and any other pre-commit checks) so the hook passes.
