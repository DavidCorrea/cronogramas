# Database

## 1. Overview

The app uses **Drizzle ORM** with **PostgreSQL** (Neon). The schema lives in a single file; migrations live under `src/db/migrations`. Do not edit migration `.sql` files or `meta/_journal.json` by hand — change the schema, then run `npm run db:generate` (with a descriptive name) after schema changes.

## 2. Schema location

**File:** `src/db/schema.ts`

All tables are defined there. Exported table names and purpose:

- **Auth**
  - `users` — Auth.js users plus `isAdmin` and `canCreateGroups`; referenced by accounts, groups, collaborators, members, holidays, audit log.
  - `accounts` — OAuth provider links; `accounts.userId` → `users`.

- **App core**
  - `groups` — Groups; `groups.ownerId` → `users`.
  - `group_collaborators` (export: `groupCollaborators`) — Group admins; `userId` → `users`, `groupId` → `groups`.
  - `members` — Group members; `members.groupId` → `groups`, `members.userId` → `users`.

- **Roles & config**
  - `roles` — Role definitions per group; `groupId` → `groups`, `exclusiveGroupId` → `exclusive_groups`, optional `dependsOnRoleId` self-ref.
  - `exclusive_groups` (export: `exclusiveGroups`) — Role exclusion groups; `groupId` → `groups`.
  - `member_roles` (export: `memberRoles`) — Which members have which roles; `memberId` → `members`, `roleId` → `roles`.
  - `weekdays` — Reference table (e.g. Lunes–Domingo); no FKs.
  - `recurring_events` (export: `recurringEvents`) — Per-weekday event config (type, label, times); `weekdayId` → `weekdays`, `groupId` → `groups`.
  - `member_availability` — Availability by weekday; `memberId` → `members`, `weekdayId` → `weekdays`.
  - `event_role_priorities` (export: `eventRolePriorities`) — Fill order per assignable event; `recurringEventId` → `recurring_events`, `roleId` → `roles`.

- **Holidays**
  - `holidays` — User- or member-scoped absence dates; `userId` → `users`, `memberId` → `members`.

- **Schedules**
  - `schedules` — One per group/month/year; `groupId` → `groups`.
  - `schedule_date` (export: `scheduleDate`) — Dates in a schedule; `scheduleId` → `schedules`, `recurringEventId` → `recurring_events`.
  - `schedule_date_assignments` (export: `scheduleDateAssignments`) — Role assignments per date; `scheduleDateId` → `schedule_date`, `roleId` → `roles`, `memberId` → `members`.
  - `schedule_audit_log` (export: `scheduleAuditLog`) — Who changed what; `scheduleId` → `schedules`, `userId` → `users`.

## 3. Migrations

- **Folder:** `src/db/migrations`. Journal and snapshots: `meta/_journal.json` and `meta/*.json` snapshots.
- **Workflow:** Edit `src/db/schema.ts` → run `npm run db:generate` (use a descriptive name when prompted) → run `npm run db:migrate`.
- **Applied migrations:** Stored in **`drizzle.__drizzle_migrations`** (schema `drizzle`). Query with schema: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;` — do not query `__drizzle_migrations` without the schema.
- Full migration rules (reset, amend, etc.) are in **`PROJECT.md`**.

## 4. Where to look

- **To add a table or column:** Edit `src/db/schema.ts`, then run `npm run db:generate` (descriptive name), then `npm run db:migrate`.
- **To find which table holds X:** Use section 2 above (tables grouped by Auth, App core, Roles & config, Holidays, Schedules); or open `src/db/schema.ts` and search for the concept (e.g. "holiday", "availability", "assignment").
- **To see current schema:** Inspect `src/db/schema.ts`; or run `npm run db:studio` and browse the database; or query `drizzle.__drizzle_migrations` to see which migrations are applied.
