# src/app — App Router (pages and API)

Next.js App Router structure:

- **Page routes** — Directories with `page.tsx` (and optional `layout.tsx`). Route map and key components: **docs/CLIENT.md**.
- **API routes** — Under **api/**; each segment has a `route.ts` handler. Full index and auth rules: **docs/API.md**.

**Notable areas:**
- Root pages: `page.tsx` (home), `login/`, `settings/`, `asignaciones/`, `admin/`, `groups/new/`.
- Group-scoped: **`[slug]/config/`** (config UI and layout), **`[slug]/cronograma/`** (public schedule view).
- API: **api/** — auth, admin, configuration, cronograma, groups, members, schedules, user, holidays. Use **docs/API.md** to find the exact file for a path.

When adding a new page or API domain, update **docs/CLIENT.md** or **docs/API.md** accordingly.
