# src/app/api — API route handlers

All API routes are Next.js App Router handlers (`route.ts` per segment). **Use docs/API.md** for the full route index (method, path, purpose, file).

**Auth:**
- Most routes: session required via `requireAuth()` or `requireGroupAccess()` (**src/lib/api-helpers.ts**).
- Admin: `requireAdmin()` (session `isAdmin` or bootstrap cookie).
- Public (no auth): **cronograma/** (rate limited by IP).

**Group-scoped routes** accept `?groupId=N` or `?slug=xxx`; slug is resolved via `resolveGroupBySlug`. Config pages typically pass `slug`.

**Domains (top-level under api/):**
- **auth/** — Auth.js (Google OAuth, session).
- **admin/** — Users (list, update, delete), bootstrap auth.
- **configuration/** — Config BFF (context), days, roles, priorities, exclusive-groups, holidays. All require group access. See **api/configuration/CONTEXT.md**.
- **cronograma/** — Public schedule by slug (GET; rate limited).
- **groups/** — List/create groups, collaborators.
- **members/** — CRUD members, link-check.
- **schedules/** — CRUD schedules, date notes.
- **user/** — Dashboard, assignments, iCal export.
- **holidays/** — User-scoped holidays (settings).
- **users/search** — User search (e.g. collaborators).

Error shape: `{ error: string, code?: string }`. Validation: Zod schemas in **src/lib/schemas/**; use `parseBody(schema, body)` in handlers.
