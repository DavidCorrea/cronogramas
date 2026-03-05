# src/db — Schema and migrations

**Schema:** Single file **schema.ts**. All tables (users, accounts, groups, group_collaborators, members, roles, exclusive_groups, member_roles, weekdays, recurring_events, member_availability, event_role_priorities, holidays, schedules, schedule_date, schedule_date_assignments, schedule_audit_log) are defined here. See **docs/DATABASE.md** for table list and relations.

**Migrations:** Folder **migrations/** (and **migrations/meta/**). Do **not** edit migration `.sql` files or `meta/_journal.json` by hand. Workflow: (1) Edit **schema.ts** → (2) `npm run db:generate` (descriptive name) → (3) `npm run db:migrate`. Full rules (reset, applied migrations table, etc.) are in **AGENTS.md** (Database and migrations).

**Applied migrations** are recorded in **`drizzle.__drizzle_migrations`** (always use schema name in queries). To inspect: `npm run db:studio` or query that table.
