---
name: drizzle-orm
description: How this project uses Drizzle ORM with PostgreSQL. Use when working with the database, schema, migrations, or writing queries. Covers postgres-js client, schema conventions, and migration workflow.
---

# Drizzle ORM in this project

## How we use it

- **Client:** Single shared client in `src/lib/db.ts`: `drizzle(postgres(DATABASE_URL), { schema })`. All routes and lib code import `db` from `@/lib/db`. Driver: **postgres-js** (`postgres`); no per-request client creation.
- **Schema:** Single file `src/db/schema.ts`. Tables use `pgTable`, `references()` for FKs, `uniqueIndex`/`primaryKey` where needed. No Drizzle `relations()` defined; types come from `$inferSelect` / `$inferInsert`.
- **Migrations:** Generated only via **drizzle-kit**. Do **not** edit migration `.sql` or `meta/_journal.json` by hand. Config: `drizzle.config.ts` (schema path, `out`, `drizzle.__drizzle_migrations`). Full workflow and rules: **AGENTS.md** (Database and migrations).
- **Queries:** All DB access via `db.select()`, `db.insert()`, `db.update()`, `db.delete()` with operators from `drizzle-orm` (`eq`, `and`, `or`, `inArray`, `max`, etc.). Prefer Drizzle aggregates (e.g. `max()`) over raw `sql` when possible.

## How it should be used

- **Single `db` instance:** Never create a second `postgres()` or `drizzle()` in app code; use the shared `db` from `@/lib/db`.
- **Schema changes:** Edit only `src/db/schema.ts` → run `npm run db:generate` (descriptive name) → run `npm run db:migrate`. See **AGENTS.md** for migration reset, applied table, and backfill rules.
- **Type safety:** Prefer schema-backed queries and Drizzle operators. Use `sql` only when an aggregate or expression isn’t available in Drizzle; prefer `max()`, `count()`, etc., when possible.
- **Imports:** Tables from `@/db/schema`; `db` from `@/lib/db`; operators/aggregates from `drizzle-orm`.

## Findings

- **Connection handling:** One top-level `postgres()` client is correct. postgres-js manages connections internally; for serverless, use an external pooler (e.g. Neon/Supabase pooler) and keep a single client per instance.
- **Raw SQL:** Only one use: roles POST used `sql\`COALESCE(MAX(displayOrder), -1)\``. Replaced with `max(roles.displayOrder)` and `(result?.maxOrder ?? -1) + 1` for consistency.
- **No `.prepare()`:** Not used; postgres-js/Drizzle handle statements. In serverless (e.g. AWS), if prepared statements cause issues, configure postgres with `{ prepare: false }` where the client is created.
- **Migrations:** Workflow and journal are in **AGENTS.md**. Snapshot files in `src/db/migrations/meta/` stay in sync via `db:generate`; do not hand-edit.
