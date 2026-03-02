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
- **API** — **docs/API.md**: route index by domain, auth (requireAuth / requireGroupAccess / cronograma public), which file to edit. Update that doc when adding or changing routes.
- **Client** — **docs/CLIENT.md**: route map (pages by path), layouts, key components, shared lib. Update when adding pages or nav.
- **Database** — **docs/DATABASE.md**: tables and relations, migration workflow. Update when changing schema.
- **Keep docs in sync:** After changing API, client, or schema, update the corresponding doc so the next agent has accurate context.

# How to work
- Split requests into units that can be done in parallel when possible; use subagents for parallel work.
- Get explicit confirmation before making changes; explain what you will do.
- After implementing a feature: add a new list item under **Features** in this file.

# Before committing
- Run **`npm run lint`** and fix any errors in the files you changed (pre-commit runs lint-staged on staged files).
- Ensure **docs/** (API, CLIENT, DATABASE) are updated if you changed routes, pages, or schema.
- One logical change per commit; one commit per feature when multiple features are requested.

---

# Features
*(Add new items here when you implement a feature.)*

## Schedule / recurring events (core model)
- **Table names**: `schedule_entries` → `schedule_date_assignments`; `schedule_days` → `recurring_events`; `day_role_priorities` → `event_role_priorities`.
- **Weekdays**: Reference table `weekdays` (id, name, display_order), 7 rows (Lunes–Domingo). `recurring_events` and `member_availability` use `weekday_id` FK.
- **Recurring events**: Per-weekday config with `type` (assignable | for_everyone) and optional `label`. Assignable → role slots and scheduler; for_everyone → schedule_date with label only.
- **Member availability**: By weekday (`member_availability.member_id`, `weekday_id`). No FK to recurring_events.
- **Event role priorities**: Only for assignable recurring events (`event_role_priorities.recurring_event_id`). Config UI: "Prioridades de roles por evento" for assignable events only.
- **Schedule generation**: Per date, type/label from recurring_events; only assignable dates run scheduler and get schedule_date_assignments.
- **Event time window**: Assignable events can have `start_time_utc` and `end_time_utc` (HH:MM UTC). Scheduler only assigns members whose availability overlaps that window on that weekday. Config: start/end inputs on event edit form (UTC). Defaults 00:00–23:59.

## Stack and setup
- Next.js 16 App Router, TypeScript, Tailwind CSS. **next-intl** for client-facing copy (single locale `es`, messages from `messages/es.json`). Drizzle ORM + PostgreSQL (postgres-js, Neon). Auth.js v5 (next-auth) Google OAuth + Drizzle adapter. Jest + ts-jest (TDD).
- **Tables**: users, accounts, groups, group_collaborators, members, exclusive_groups, roles, member_roles, weekdays, recurring_events, member_availability, holidays, schedules, schedule_date, schedule_date_assignments, schedule_audit_log, event_role_priorities.

## User authentication
- Google OAuth, JWT session. Users table: Auth.js fields + `isAdmin`, `canCreateGroups`. Accounts: OAuth links.
- Login `/login`, Settings `/settings`. Middleware: session check; redirect to `/login` or 401 for API. Public paths: `/login`, `/api/auth/*`, `/:slug/cronograma/*`, `/api/cronograma/*`, `/admin/*`, `/api/admin/*`.

## Admin panel
- `/admin`: manage users (isAdmin, canCreateGroups, delete). Access: `isAdmin === true` or bootstrap when no admin users.
- Bootstrap: `/admin/login` with `ADMIN_USERNAME`/`ADMIN_PASSWORD` env, short-lived cookie. Group creation: only `canCreateGroups` or `isAdmin`. API: `GET/PUT/DELETE /api/admin/users`, `POST /api/admin/auth`.

## Multi-group architecture
- Multiple groups; each has members, roles, schedules, config. Groups: id, name, slug (unique), owner_id. Slug in URLs.
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
- Recurring events: active, type, label per weekday; assignable can set start/end time UTC. Column order: role list reorder, "Guardar orden". Event role priorities: assignable events only. Member availability: 7 weekdays (member_id, weekday_id). API: `/api/configuration/days?groupId=N`, `/api/configuration/priorities?groupId=N`.

## Schedule generation & preview
- `/:slug/config/schedules`. One row per date in `schedule_date` (type assignable | for_everyone, label, note). Assignments in schedule_date_assignments. Add/remove date; notes in Editar modal; times in UTC in DB, shown/edited in user TZ. Rebuild from today: Overwrite or Fill empty, with preview. Audit log: "Historial de cambios". API: `/api/schedules?groupId=N`, `/api/schedules/[id]`, `/api/schedules/[id]/notes`.

## Dashboard, navigation, public view
- **Dashboard**: `/`, cross-group assignments, conflicts (same date multiple groups). API `GET /api/user/dashboard`.
- **Nav**: AppNavBar (root layout): Cronogramas, Inicio, Ajustes, auth. GroupSubNav (config layout): group name, Miembros, Roles, Configuración, Vacaciones, Colaboradores, Cronogramas.
- **Public view**: `/:slug/cronograma`, `/:slug/cronograma/:year/:month`; mobile-first, dark toggle, member filter; API `/api/cronograma/:slug`, `/api/cronograma/:slug/:year/:month`.

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
