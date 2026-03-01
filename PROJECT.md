# Features

## Schedule entries rename and recurring event config
- **Table renames**: `schedule_entries` → `schedule_date_assignments`; `schedule_days` → `recurring_events`; `day_role_priorities` → `event_role_priorities`.
- **Weekdays**: Reference table `weekdays` (id, name, display_order) with 7 rows (Lunes–Domingo) for consistent weekday references. `recurring_events` and `member_availability` use `weekday_id` FK.
- **Recurring events**: Per-weekday config with `type` (assignable | for_everyone) and optional `label`. Assignable events get role slots and scheduler; for_everyone events create schedule_date with label only.
- **Member availability**: Stored by weekday (`member_availability.member_id`, `weekday_id`). No FK to recurring_events so adding a new recurring event for a weekday automatically includes members available that day.
- **Event role priorities**: Priorities apply only to assignable recurring events (`event_role_priorities.recurring_event_id`). Config UI shows "Prioridades de roles por evento" for assignable events only.
- **Schedule generation**: For each date, type/label come from recurring_events; only assignable dates run the scheduler and get schedule_date_assignments.
- **Config UI**: Recurring events form (active + type + label per weekday); member availability toggles for 7 weekdays; event role priorities section filtered to assignable events.
- **Recurring event time window**: Assignable recurring events have optional `start_time_utc` and `end_time_utc` (HH:MM UTC). The scheduler only assigns members whose availability blocks overlap this window on that weekday. Config UI: start/end time inputs on the event edit form (UTC). Defaults 00:00–23:59 preserve previous behaviour.

## Project Setup
- Next.js 16 with App Router, TypeScript, Tailwind CSS
- Drizzle ORM with PostgreSQL (postgres-js driver, Neon-hosted) for data persistence
- Auth.js v5 (next-auth) with Google OAuth and Drizzle adapter for authentication
- Jest with ts-jest for testing (TDD)
- Database schema with tables: users, accounts, groups, group_collaborators, members, exclusive_groups, roles, member_roles, weekdays, recurring_events, member_availability, holidays, schedules, schedule_date, schedule_date_assignments, schedule_audit_log, event_role_priorities

### Scripts
- `npm run dev` — Start the dev server
- `npm test` — Run tests
- `npm run test:watch` — Run tests in watch mode
- `npm run db:generate` — Generate a new migration after schema changes
- `npm run db:migrate` — Apply pending migrations
- `npm run db:studio` — Open Drizzle Studio to inspect the database

### Migrations (Drizzle)
Migrations are managed with **drizzle-kit**. Do not create or edit migration `.sql` files or `meta/_journal.json` by hand; use the generate step so that `drizzle-kit migrate` works reliably.

**Creating a migration**
1. Edit the schema in `src/db/schema.ts` (add/change/remove tables or columns).
2. Run **`npm run db:generate`** (or `npx drizzle-kit generate`). When prompted for a name, use a short descriptive slug (e.g. `add_schedule_date_start_end_time_utc`). This will:
   - Create a new `.sql` file under `src/db/migrations/` with the correct DDL.
   - Update `src/db/migrations/meta/_journal.json` with the new migration entry.
   - Add a new snapshot in `src/db/migrations/meta/` so the next generate can diff against it.
3. Run **`npm run db:migrate`** to apply pending migrations (or let the build run it). Migrations are recorded in `drizzle.__drizzle_migrations` by hash.

**Applying migrations**
- Locally: `npm run db:migrate` (requires `DATABASE_URL` in `.env` or `.env.local`).
- On deploy: `npm run build` runs `drizzle-kit migrate` then `next build`, so migrations run automatically if `DATABASE_URL` is set in the environment.

**If migrate doesn’t apply some migrations** (e.g. build failed mid-migrate, or DB was restored from backup): apply the missing schema manually using the idempotent scripts in `scripts/` (e.g. `apply-migration-0015.sql`), then run `node scripts/record-migrations-0012-0014.mjs` once so future migrate runs skip those by hash. See “If not all migrations ran” under Deployments (Vercel) below.

**One-time fix: missing snapshots for 0012–0015**  
Migrations 0012–0015 were added by hand, so `meta/` has no snapshot for them (only 0000–0006). That makes `db:generate` diff against 0006 and produce a huge migration. To fix it once:

1. **Get the DB and migrate table in sync**  
   - Apply the missing schema: run `scripts/apply-missing-migrations-0012-0014.sql` and `scripts/apply-migration-0015.sql` in your SQL editor (Neon, etc.) if the DB doesn’t have 0012–0015 yet.  
   - Run `node scripts/record-migrations-0012-0014.mjs` so `drizzle.__drizzle_migrations` has 16 rows (0000–0015). Now `npm run db:migrate` will do nothing, as expected.

2. **Create the 0015 snapshot so generate works**  
   - Run `npm run db:generate -- --name=baseline_0015`. When drizzle-kit asks “create or rename” for any table, choose **create table** (first option) for each.  
   - Run `node scripts/baseline-migration-snapshot.mjs`. It copies the new snapshot to `0015_snapshot.json`, removes the generated migration file and its journal entry, so the journal stays at 0000–0015 with a matching 0015 snapshot.

After this, `db:generate` will diff against 0015 and future migrations will be small and correct.

### Deployments (Vercel)
- **Migrations** run during build: `npm run build` runs `drizzle-kit migrate` then `next build`. The app uses `DATABASE_URL` from the environment (no `.env.local` on Vercel), so set **DATABASE_URL** in Vercel → Project → Settings → Environment Variables for Production (and Preview if you want migrations on preview deploys).
- **If not all migrations ran** (e.g. build failed during migrate, or production DB was restored from backup): (1) Apply the missing schema in Neon SQL editor using the idempotent scripts in `scripts/` (e.g. `apply-missing-migrations-0012-0014.sql`, `apply-migration-0015.sql`). (2) If `drizzle-kit migrate` never marks those as applied, run once: `node scripts/record-migrations-0012-0014.mjs` so future migrate runs skip them by hash.

## User Authentication
- **Google OAuth** via Auth.js v5 with JWT session strategy
- **Users table**: Auth.js managed (id, name, email, emailVerified, image) plus `isAdmin` and `canCreateGroups` flags
- **Accounts table**: Auth.js managed (OAuth provider links)
- **Login page** at `/login` with Google sign-in button
- **Settings page** at `/settings` for user profile, personal holiday management, and admin panel link (if admin)
- **Middleware**: checks for session cookie; redirects to `/login` for unauthenticated page requests, returns 401 for unauthenticated API calls
- **Public paths**: `/login`, `/api/auth/*`, `/:slug/cronograma/*`, `/api/cronograma/*`, `/admin/*`, `/api/admin/*`

## Admin Panel
- **Admin page** at `/admin` for managing all users (toggle `isAdmin`, `canCreateGroups`, delete users)
- Only accessible by users with `isAdmin === true`, or via bootstrap credentials when no admin users exist
- **Bootstrap mode**: when no admin users exist in the database, `/admin/login` accepts `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars and sets a short-lived cookie for access
- **Group creation gating**: only users with `canCreateGroups` or `isAdmin` can create groups (enforced at API and UI level)
- **API routes**: `GET/PUT/DELETE /api/admin/users`, `POST /api/admin/auth` (bootstrap login)

## Multi-Group Architecture
- The app supports multiple independent groups, each with their own members, roles, schedules, and configuration
- **Groups table**: `id`, `name`, `slug` (unique), `owner_id` (FK to users). Slug is used in client-facing URLs
- **Group creation**: dedicated page at `/groups/new`. Users can configure the group name, slug, active days, roles, and collaborators in a single form. All optional config is sent with the group creation in one API call. If no days are configured, defaults are seeded (Wednesday, Friday, Sunday active)
- **Group collaborators**: users with full admin access to a group (same as owner). Managed via `/:slug/config/collaborators`
- **Members**: belong to a group with their own `name` and optional `email` columns. Optionally linked to a user via `user_id` (nullable). When a member has an email set and a new user signs in with that email for the first time, the member is automatically linked to the new user
- **Group scoping**: `members`, `roles`, `exclusive_groups`, `recurring_events`, and `schedules` tables have a `group_id` FK
- **Unique constraint**: schedules have a unique index on `(group_id, month, year)` — one schedule per month per group
- **Landing page** at `/` (behind auth): lists all groups the user owns, collaborates on, or is a member of (with role badges). Shows cross-group upcoming assignments with conflict detection. Links to `/groups/new` for group creation (visible only to users with permission)
- **Admin routes**: `/:slug/config/*` — scoped to a group via slug in URL. Requires owner or collaborator access
- **Public routes**: `/:slug/cronograma` (current month), `/:slug/cronograma/:year/:month` (specific month)
- **API routes**: admin APIs at their original paths (e.g. `/api/members`, `/api/schedules`) accept `groupId` as a query parameter with auth + group access checks. Public APIs at `/api/cronograma/:slug/*`
- **Group context**: `src/lib/group-context.tsx` provides `GroupProvider` and `useGroup()` hook

## Holidays
- **User-scoped holidays**: Each user manages their own absence dates from `/settings`. These apply globally across all groups the user belongs to. API: `GET/POST/DELETE /api/holidays`
- **Member-scoped holidays**: Admins can set absence dates for specific members (linked or unlinked) from the group holidays page (`/:slug/config/holidays`). These are scoped to the member. API: `GET/POST/DELETE /api/configuration/holidays?groupId=N`
- **Group holidays page** (`/:slug/config/holidays`): shows both user-scoped and member-scoped holidays for the group, filtered to current and future dates only. User-scoped holidays are read-only (managed in `/settings`). Member-scoped holidays can be added and deleted by admins
- The scheduler combines both sources: for linked members it fetches user-level + member-level holidays; for unlinked members it only fetches member-level holidays

## Schedule Generation Algorithm
- Pure function in `src/lib/scheduler.ts` with types in `src/lib/scheduler.types.ts`
- Takes dates, roles (with required counts), and members (with roles, availability, holidays) as input
- **Round-robin rotation with per-day-of-week pointers**: For each role, an alphabetically-sorted list of capable members is maintained with a separate pointer for each day of the week
- **Event time window**: When a recurring event has start/end time (UTC), only members with at least one availability block overlapping that window on that weekday are considered eligible for assignment
- Previous assignments can be passed in to initialise rotation continuity across months
- **Configurable role dependencies (manual selection)**: Dependent roles are left empty during generation and manually selected by the user
- **Exclusive role groups**: Roles in the same exclusive group cannot be assigned to the same member on the same date
- **Day role priorities**: Roles are sorted by day-specific priority before filling (event role priorities: assignable recurring events only)

## Member Management
- Members belong to a group and have their own `name` column
- Members can optionally be linked to a `User` account (via `user_id`). Linked members benefit from user-scoped holidays and can see their assignments on the dashboard
- Members without a linked user can still be scheduled and have admin-set holidays
- Adding a member: provide a name (required) and optionally link to a user by searching their email
- Editing a member: update name, link/unlink user, update roles and availability (by weekday: 7 weekdays, not tied to recurring events)
- API routes: `GET/POST /api/members?groupId=N`, `GET/PUT/DELETE /api/members/[id]`

## Role Management
- Dedicated `/:slug/config/roles` page for managing roles and exclusive groups
- Roles: view, add, rename, delete, configure with required counts, dependencies, exclusive groups, and relevance flag
- **New role** (`/config/roles/new`): create role (name only; default required count 1) and optionally assign group members to the role. Assignments are persisted on "Agregar rol".
- **Edit role** (`/config/roles/[id]`): edit role fields and manage "Personas con este rol" (list of members with this role; add/remove via dropdown). Changes persisted only on "Actualizar".
- **Unsaved changes**: On new or edit role page, leaving (nav link, Cancelar, or closing tab) shows a warning if there are unsaved changes. Uses `UnsavedConfigProvider`; config layout guards navigation when `configDirty` on roles form pages.
- API routes: `/api/configuration/roles?groupId=N`, `/api/configuration/exclusive-groups?groupId=N`

## Configuration
- **Recurring events**: Per-weekday config (active, type, label). Type `assignable`: role slots and scheduler; type `for_everyone`: label only (e.g. "Ensayo", "Picnic"). Toggle active days and set type/label per day. **Event time window**: For assignable events, start and end time (UTC) can be set; the scheduler only assigns members whose availability overlaps that window.
- **Column Order**: Configurable display order for role columns; list of role names with up/down (or left/right on desktop) arrow buttons to reorder. Save with "Guardar orden".
- **Event role priorities**: Fill order per **assignable** recurring event (priorities by day). Only assignable events show in the priorities section.
- **Member availability**: By weekday (7 days). Stored as (member_id, weekday_id); not tied to which recurring events exist, so adding a new recurring event for a weekday automatically includes members available that day.
- API routes: `/api/configuration/days?groupId=N` (recurring events with type/label), `/api/configuration/priorities?groupId=N` (event_role_priorities, recurringEventId)

## Schedule Generation & Preview
- Generate schedules for one or more months at a time via `/:slug/config/schedules`
- **Unified schedule date model**: One row per calendar date in a schedule in `schedule_date` (id, schedule_id, date, type, label, note). Type is `assignable` (role slots and assignments) or `for_everyone` (display-only with optional label). `schedule_date_assignments` reference `schedule_date_id`.
- **Recurring config**: `recurring_events` (per group, per weekday): active, type (assignable | for_everyone), label. `weekdays` reference table ensures consistent weekday names (Lunes–Domingo).
- **One schedule per month/year per group**: Enforced at database level with unique index
- **Generation**: For each date in the month on active weekdays, one `schedule_date` row is created with type and label from the recurring event; only assignable dates run the scheduler and get `schedule_date_assignments`. Member availability is by weekday (`member_availability.weekday_id`).
- **Add date**: Add a single date to a schedule with type "assignable" or "for_everyone" and optional label (for for_everyone). No separate "extra" or "rehearsal" tables
- **Remove date**: Delete a `schedule_date` row (assignments cascade). Single action for any date
- **Notes**: Edit note on the schedule date in the Editar modal; saved to `schedule_date.note` via update_date or notes API.
- **Schedule date times**: Start/end time are persisted in UTC in `schedule_date.start_time_utc` and `end_time_utc`. The schedule edit view (Editar modal) and any other UIs show and edit times in the user's local timezone; conversion to/from UTC happens on load and save. Users do not see or need to know about UTC.
- Preview in grid, manual swap/edit, dependent role selection, date notes
- **Rebuild from today**: Regenerate assignments from today onwards in two modes — "Overwrite" (replaces all future entries) or "Fill empty" (keeps existing assignments, only fills vacant slots). Shows a full preview of proposed assignments before applying
- **Audit log**: Tracks all schedule mutations (created, published, bulk updates, rebuilds, add/remove date, note changes) with who made the change and when. Bulk updates and rebuilds store structured JSON diffs with individual assignment changes. Displayed in a collapsible "Historial de cambios" section at the bottom of the schedule edit view.
- **Previous/Next navigation** in both admin and public views
- API routes: `/api/schedules?groupId=N`, `/api/schedules/[id]`, `/api/schedules/[id]/notes`

## Dashboard
- Home page (`/`) shows cross-group upcoming assignments with conflict detection
- Conflicts: same date in multiple groups highlighted in red
- API: `GET /api/user/dashboard`

## Navigation
- **Global nav bar** (`AppNavBar`): Rendered in the root layout on every page except `/login`. Shows "Cronogramas" title linking to `/`, "Inicio" and "Ajustes" links, and user avatar/name/sign-out when authenticated. Shows "Iniciar sesión" link when unauthenticated. Includes a mobile hamburger menu
- **Group sub-nav** (`GroupSubNav`): Rendered in the config layout (`/:slug/config/*`) below the global nav. Shows the group name and section links (Inicio, Miembros, Roles, Configuración, Vacaciones, Colaboradores, Cronogramas). Mobile hamburger for section links only. No user info (handled by global nav)

## Localisation
- All UI text in Spanish
- App name: **Cronogramas**

## Shared Public View
- Public read-only page at `/:slug/cronograma/:year/:month` — no admin navigation shown
- Mobile-first responsive design, light/dark mode toggle, member filter
- Dependent and relevant role highlighting, date notes. Each date shows type (assignable role grid or for_everyone label/note) from unified `schedule_date` data
- Previous/Next navigation between committed schedules
- Current month view at `/:slug/cronograma`
- Public API: `/api/cronograma/:slug` (current month), `/api/cronograma/:slug/:year/:month` (specific month)

## Default Seeds
- **Weekdays**: Reference table `weekdays` seeded with 7 rows (Lunes–Domingo) in migration.
- **Recurring events** are seeded per group on creation if no day configuration is provided (defaults: Wednesday, Friday, Sunday active, type assignable). Each recurring event has `weekday_id`, `active`, `type`, `label`.
- No default roles are seeded; configured by the user via the roles page or during group creation

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `NEXTAUTH_SECRET` — Random secret for JWT encryption
- `AUTH_TRUST_HOST=true` — Required for deployment
- `ADMIN_USERNAME` — Bootstrap admin username (only used when no admin users exist)
- `ADMIN_PASSWORD` — Bootstrap admin password (only used when no admin users exist)
