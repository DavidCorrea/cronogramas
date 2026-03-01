# Project Overview
- Found in `PROJECT.md`.

# Build and test commands
- Found in `PROJECT.md`.

# How to work
- All requests must be analyzed and split into units of work in such way that they can be done in parallel, if possible.
- Parallel work should be tacked by as many subagents as it is fit.

# UI
- All views must be thought of being mobile-first (if possible)
- Any client-facing content must be in Spanish.

# Code style guidelines
- Ensure clean code practices are followed
- Do not perform any changes without having explicit confirmation from the Prompter
- Explain all changes that are going to be done
- Document any new feature in `PROJECT.md` after it was implemented for easier context update. Do it under the `Features` section in a new list item.

# Testing instructions
- Use `Jest` library for testing.
- All tests are located under the `spec` folder.
- Every feature that is implemented needs to follow Test Driven Development practices.
- Tests are the documentation of the project, so their description should not contain technical terms. They need to describe real scenarios.

# Security considerations
- Any password that is stored in the application must not be stored in plain text.
- Passwords that will be stored must be hashed with `bcrypt` and must be "salted" with a unique and random salt, that will be also persisted alongside the hashed password.
- Passwords will then be checked by hashing the user's password attempt with the stored salt and compare the results.

# Database
- All migrations should require in the filename a general idea of what the migration is doing.
- **Migrations must be created with drizzle-kit, not by hand.** Do not create or edit migration `.sql` files or `src/db/migrations/meta/_journal.json` manually (except when following a documented one-off recovery step). Follow this workflow:
  1. **Change the schema** in `src/db/schema.ts` (add/remove/alter tables or columns).
  2. **Generate the migration**: run `npm run db:generate` (or `npx drizzle-kit generate`). Use a descriptive name when prompted (e.g. `add_schedule_date_start_end_time_utc`). This will:
     - Create a new `.sql` file under `src/db/migrations/` with the correct statements.
     - Update `src/db/migrations/meta/_journal.json` with the new entry.
     - Add a new snapshot under `src/db/migrations/meta/` for the next diff.
  3. **Apply the migration**: run `npm run db:migrate` (or rely on build, which runs migrate). This applies pending migrations and records them in `drizzle.__drizzle_migrations`.
- If a schema change cannot be expressed by editing `schema.ts` alone (e.g. data backfill, or a one-off fix), document the reason and the manual steps in `PROJECT.md` or a script in `scripts/`, and still run `db:generate` after any schema change so snapshots stay in sync.

# Git
- All commits must only include related changes (e.g. related to the same feature or task being tackled)
- When multiple features are requested at the same time, ensure you make a commit for each feature in particular (e.g. given two features were requested, one commit for feature 1 and another commit for feature 2)