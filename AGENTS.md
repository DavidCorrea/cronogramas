# Cronogramas — Agent playbook

Read this file first. It tells you what to read, how to work, and project-specific conventions not covered by `.cursor/rules/`.

---

# When you begin

- **First action:** Read **`DOMAIN.md`** (glossary, business rules) and **`STRUCTURE.md`** (codebase map) at the project root.
- **Touching a library we use?** Read the matching skill in **`.cursor/skills/<name>/SKILL.md`** before changing or adding usage. Skills: `nextjs`, `next-auth`, `next-intl`, `react`, `tanstack-react-query`, `drizzle-orm`, `zod`, `radix-ui-dialog`, `radix-ui-tooltip`, `react-hotkeys-hook`, `googleapis`, `tailwind`, `typescript`, `web-vitals`.
- **Adding or changing API routes?** See **docs/API.md**.
- **Adding or changing pages or nav?** See **docs/CLIENT.md**.
- **Changing schema or migrations?** See **docs/DATABASE.md** and the "Database and migrations" convention below.

---

# Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint; fix in changed files before committing |
| `npm test` / `npm run test:watch` | Tests (TDD for new features) |
| `npm run build` | `drizzle-kit migrate` then `next build` |
| `npm run db:generate` | Generate migration after schema change (descriptive name when prompted) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run seed` | Realistic seed (50 users, 35 groups). `npm run seed -- --user=UUID`. Optional `--seed=N` for reproducibility. |

---

# Workflow

1. **Plan:** Get explicit confirmation before making changes; explain what you will do.
2. **Done = green:** Work is complete only when **`npm run lint`** and **`npm run build`** pass. Fix any failures before finishing.
3. **Before committing:** One logical change per commit. Update **docs/** (API.md, CLIENT.md, DATABASE.md) if you changed routes, pages, or schema. New copy goes in **`messages/es.json`**. Do not commit with `--no-verify`.

---

# Conventions (project-specific)

Rules in `.cursor/rules/` (both project-specific and symlinked from `code-rules/`) cover general conventions: code clarity, communication, git, security, simplicity, testing. The conventions below are **project-specific** and complement those rules.

**UI / i18n** — Mobile-first. All user-facing text in **Spanish**. Copy lives in **`messages/es.json`**; use next-intl: `useTranslations('namespace')` and `t('key')` in components.

**Database and migrations** — **drizzle-kit only**. Do not create or edit migration `.sql` or `_journal.json` by hand.
- **Workflow**: (1) Edit `src/db/schema.ts` → (2) `npm run db:generate` (descriptive name) → (3) `npm run db:migrate`.
- **Deploy**: `npm run build` runs migrate then next build; set DATABASE_URL in Vercel.
- **Config**: `drizzle.config.ts` uses `drizzle.__drizzle_migrations`. Check applied: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at;`.

**Env vars** — `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`), `AUTH_TRUST_HOST=true`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
