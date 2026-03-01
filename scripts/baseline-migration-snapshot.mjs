/**
 * One-time fix: after running `npm run db:generate -- --name=baseline_0015` and
 * choosing "create table" for any prompts, run this script to use the newly
 * generated snapshot as the 0015 snapshot. This fixes the missing 0015 snapshot
 * so future `db:generate` diffs against 0015 instead of 0006.
 *
 * Run from project root: node scripts/baseline-migration-snapshot.mjs
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const metaDir = join(root, "src", "db", "migrations", "meta");
const migrationsDir = join(root, "src", "db", "migrations");

const journalPath = join(metaDir, "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const entries = journal.entries;

if (entries.length < 2) {
  console.error("Journal has too few entries. Nothing to baseline.");
  process.exit(1);
}

const last = entries[entries.length - 1];
const lastIdx = last.idx;
const lastTag = last.tag;

if (lastIdx <= 15) {
  console.error("Last journal entry is", lastIdx, "- expected 16 (from a fresh generate). Exiting.");
  process.exit(1);
}

const snapshotSource = join(metaDir, `${String(lastIdx).padStart(4, "0")}_snapshot.json`);
const snapshotTarget = join(metaDir, "0015_snapshot.json");

if (!existsSync(snapshotSource)) {
  console.error("Snapshot not found:", snapshotSource);
  process.exit(1);
}

const migrationFiles = readdirSync(migrationsDir).filter((f) => f.startsWith(`${String(lastIdx).padStart(4, "0")}_`) && f.endsWith(".sql"));

copyFileSync(snapshotSource, snapshotTarget);
console.log("Copied", snapshotSource, "->", snapshotTarget);

for (const f of migrationFiles) {
  unlinkSync(join(migrationsDir, f));
  console.log("Deleted migration", f);
}

journal.entries = entries.slice(0, -1);
writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");
console.log("Removed journal entry", lastIdx, lastTag);

console.log("Done. Next db:generate will diff against 0015_snapshot.");
