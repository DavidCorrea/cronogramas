# Scripts

One-off or occasional scripts for data and ops. Not part of the Next.js app or migrations.

## seed.ts

Large realistic seed for QA and demos: **50 users**, **35 groups** (10 solo artists, 10 jazz trios, 10 rock bands, 5 orchestras).

**Run:** `npm run seed` (requires Node, `DATABASE_URL` in `.env` or `.env.local`).

**Owner user ID** (specified user; creates some groups and is linked as member "Yo" where they own). Pass one of:

- `npm run seed -- --user=<UUID>`
- `SEED_OWNER_ID=<UUID> npm run seed`
- `npx tsx scripts/seed.ts <UUID>`

**Optional:** `--seed=N` for reproducible randomness (e.g. `npm run seed -- --user=UUID --seed=42`).

**Users:** The specified user (passed in) plus **49 seed users** created by the script (fixed IDs, `seed-001@seed.example.com` … `seed-049@seed.example.com`). Total 50 users. Group owners are chosen at random from this pool (~30% specified user, rest from the 49).

**Slugs:** Derived from group/artist names (lowercase, hyphens, accents normalized). Examples: "Rosalía Vega – Cantautora" → `rosalia-vega-cantautora`, "Trío Jazz Los Andes" → `trio-jazz-los-andes`. Uniqueness: if the slug exists, a numeric suffix is added (e.g. `trio-jazz-los-andes-2`).

**Solo artists:** 10 groups; names inspired by popular Latin artists (slightly altered). One member per group; when the specified user owns the group, that member is "Yo" linked to them.

**Jazz trios / rock bands / orchestras:** Realistic Spanish names; members get varied availability (full week, evenings only, weekends, etc.). Some members are linked to seed users so the same user appears in multiple groups (conflict simulation). When the specified user owns a group, they appear as "Yo" with reserved assignment slots.

**Collaborators:** A subset of groups get 1–2 collaborators (random users from the pool, excluding the owner). The **specified user is added as collaborator on at least one group they do not own**.

**Schedule status:** Each schedule (month) is created with status **draft** or **committed** at random (~50/50).

**Holidays:** ~70% of users get 0–2 user-level holidays; the specified user gets at least 1. Random members in various groups get 0–2 member-level holidays. Some users/members have none.

**Prerequisites:** Migrations applied (especially `weekdays` table with 7 rows). If the specified user does not exist yet, the script still runs (you will see their groups once that user exists).

**Idempotent:** Skips creating a group if a group with that slug already exists.
