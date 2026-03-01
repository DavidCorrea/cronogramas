/**
 * Records migrations 0012–0015 in drizzle.__drizzle_migrations so that
 * drizzle-kit migrate no longer tries to run them (e.g. when migrate hangs
 * or doesn't complete). Run after applying the schema with
 * scripts/apply-missing-migrations-0012-0014.sql and scripts/apply-migration-0015.sql.
 *
 * Usage: DATABASE_URL='postgresql://...' node scripts/record-migrations-0012-0014.mjs
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();
dotenv.config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "src", "db", "migrations");

const tags = [
  "0012_recurring_events_start_end_time_utc",
  "0013_recurring_events_label_required",
  "0014_schedule_date_recurring_event_id",
  "0015_schedule_date_start_end_time_utc",
];

const entries = tags.map((tag) => {
  const content = readFileSync(join(migrationsDir, `${tag}.sql`), "utf8");
  const hash = createHash("sha256").update(content).digest("hex");
  return { hash, created_at: Date.now() };
});

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url);

async function main() {
  const existing = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const existingSet = new Set(existing.map((r) => r.hash));
  let inserted = 0;
  for (const { hash, created_at } of entries) {
    if (existingSet.has(hash)) continue;
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${created_at})`;
    inserted++;
  }
  console.log(`Recorded ${inserted} migration(s) (0012–0015) in drizzle.__drizzle_migrations`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
