# Cronogramas improvement roadmap

A consolidated roadmap to improve Cronogramas across API design, security, performance, accessibility, UX, product clarity, and maintainability—while preserving all existing features.

This plan groups improvements into themes. Each theme can be implemented independently or in sequence; dependencies are noted where relevant. Use this doc to pick and tackle items week by week.

**How to use this roadmap when implementing**

1. **Pick one item** from a section (or from "Suggested order").
2. **Where to look** — Open the listed files/modules; read `CONTEXT.md` in relevant folders if present (see AGENTS.md).
3. **Implementation notes** — Follow the steps or checklist; add Zod schemas in `src/lib/schemas/`, APIs under `src/app/api/`, copy in `messages/es.json`.
4. **Done when** — Satisfy the acceptance criterion; run `npm run lint` and `npm run build`; update **Docs to update as you go** (API.md, CLIENT.md, DATABASE.md, AGENTS.md as needed).
5. **Dependencies** — If an item says "Requires §X" or "After Y", implement or assume Y first.

**Quick reference (key paths for implementation)**

| Section | Key files / modules |
|--------|----------------------|
| Security | `src/app/api/schedules/[id]/notes/route.ts`, `src/app/api/groups/route.ts`, `src/app/api/auth/callback/google-calendar/route.ts`, `src/lib/api-helpers.ts`, `src/lib/rate-limit.ts`, `src/lib/schemas/` |
| §1 Library usage | `src/app/layout.tsx`, `src/i18n/request.ts`, `src/app/page.tsx`, `src/app/admin/page.tsx`, `package.json` |
| §2 Accessibility | `src/app/layout.tsx`, `src/components/AppNavBar.tsx`, `src/components/SharedScheduleView/`, `messages/es.json` |
| §3 Performance | `src/lib/public-schedule.ts`, `src/components/SharedScheduleView/` |
| §4 Client data/forms | `src/lib/schemas/`, `src/lib/api-helpers.ts`, forms under `src/app/[slug]/config/` |
| §5 Product/UX | Config landing `src/app/[slug]/config/page.tsx`, cronograma page, `messages/es.json` |
| §6 Data/domain | `docs/DATABASE.md`, `AGENTS.md`, `src/db/schema.ts` |
| §7 Schedule flows | `src/app/[slug]/config/schedules/[id]/page.tsx`, `src/app/groups/new/page.tsx`, `src/app/api/groups/route.ts`, `src/app/api/schedules/` |
| §8 Operations | `src/db/schema.ts`, `src/app/api/`, `spec/`, `docs/API.md` |
| §9 Polish | `src/app/layout.tsx`, cronograma routes, PWA config |
| §10 More product | `src/components/`, conflict logic in `src/app/api/user/dashboard/route.ts`, `src/app/[slug]/config/schedules/[id]/page.tsx` |
| §11 Simpler usage / conflicts | `src/app/asignaciones/page.tsx`, `src/lib/holiday-conflicts.ts`, `src/lib/schedule-helpers.ts`, scheduler, `src/components/SharedScheduleView/`, schedule detail page |

---

## Security

**Schedule notes GET unauthenticated**  
`GET /api/schedules/[id]/notes` returns date notes for any schedule ID without requiring authentication. Schedule IDs are exposed in the config UI (and in public cronograma API responses as `id`). Anyone who knows or guesses a schedule ID can enumerate and read all notes (date + description) for that schedule. **Recommendation:** Require authentication and group access (e.g. `requireAuth()` then `hasGroupAccess(userId, schedule.groupId)`) for GET notes, consistent with POST/DELETE on the same route.

- **Where to look:** `src/app/api/schedules/[id]/notes/route.ts` (GET handler); `src/lib/api-helpers.ts` for `requireAuth`, `hasGroupAccess`; load schedule to get `groupId` (e.g. from `schedule_date` or schedules table).
- **Done when:** GET notes returns 401 without session and 403 when user lacks group access; POST/DELETE unchanged. Update docs/API.md (auth for GET notes).

**Group metadata by slug without access check**  
`GET /api/groups?slug=xxx` returns the full group row (id, name, slug, ownerId, calendarExportEnabled, etc.) for any slug without verifying that the requester owns, collaborates on, or is a member of that group. Any authenticated user can probe for group existence and read group metadata by guessing or enumerating slugs. **Recommendation:** When `slug` is provided, resolve the group then check `hasGroupAccess(user.id, group.id)` (or membership); return 403 if the user has no access, and 404 only when the group does not exist (to avoid slug enumeration if desired), or 403 for both to simplify.

- **Where to look:** `src/app/api/groups/route.ts` (GET with `slug` query); `src/lib/api-helpers.ts` for `hasGroupAccess`; resolve group by slug (existing or new helper).
- **Done when:** GET with `?slug=xxx` returns 403 when requester has no access; 404 only when group does not exist (or 403 for both). Update docs/API.md.

**Google Calendar callback uses state.userId for user-assignments flow**  
In `/api/auth/callback/google-calendar`, the "user assignments" (Mis asignaciones) flow uses `state.userId` from the OAuth callback URL to decide whose assignments to export. The state parameter is client-controllable (it is sent to Google and back in the URL). An attacker can start the export flow, then when redirected back from Google replace the `state` parameter with a forged payload that has the same `nonce` (visible in the original redirect URL) and a victim's `userId`. The callback would then add the victim's assignments to the attacker's Google Calendar (the OAuth token belongs to the attacker). **Recommendation:** In the user_assignments branch of the callback, ignore `state.userId` and use the current session's user id (e.g. from `auth()`) to load assignments and enforce `canExportCalendars`. Keep `state` only for nonce verification and optional filters (groupId, year, month).

- **Where to look:** `src/app/api/auth/callback/google-calendar/route.ts`; locate the `user_assignments` / Mis asignaciones branch and replace use of `state.userId` with session user id from `auth()` (next-auth).
- **Done when:** Callback for user_assignments always uses session user; no assignment export for another user even if state is forged. No doc change required if behavior is internal.

**Admin bootstrap cookie stores raw password**  
Bootstrap admin auth sets a cookie `admin-bootstrap-token` with the value of `ADMIN_PASSWORD`. The cookie is httpOnly and short-lived (1 hour), but the secret stored in the cookie is the same as the env credential. If the cookie is ever captured (e.g. via a bug or logging), the admin password is compromised. **Recommendation:** Use a one-time or short-lived random token (e.g. stored in memory or a small server-side store keyed by token) and set that in the cookie instead; validate the token server-side without reusing `ADMIN_PASSWORD` as the cookie value. Optionally restrict the cookie path to `/admin` and `/api/admin` to reduce exposure.

- **Where to look:** `src/app/api/admin/auth/route.ts` (sets cookie); any middleware or API that reads `admin-bootstrap-token` cookie (e.g. `requireAdmin()` or admin auth check).
- **Done when:** Cookie value is a random token; server validates token against in-memory or server-side store; `ADMIN_PASSWORD` never sent to client. Document in AGENTS.md or API.md if auth flow changes.

**User search exposes all matching users**  
`GET /api/users/search?q=...` returns id, name, email, and image for up to 10 users matching the query (minimum 2 characters). Any authenticated user can harvest other users' emails and names by searching. **Recommendation:** Consider restricting who can call this (e.g. only group owners/collaborators when adding collaborators or linking members), or limit returned fields (e.g. no email, or only show email for users already in the same group). If the current behavior is intentional (e.g. for invites), document it and consider rate limiting and a higher minimum query length.

- **Where to look:** `src/app/api/users/search/route.ts`; call sites (collaborators UI, member link UI) in `src/app/[slug]/config/`.
- **Done when:** Access restricted or response limited as chosen; if rate limiting added, use `src/lib/rate-limit.ts` or new helper. Update docs/API.md.

**Rate limit bypass via spoofed IP headers**  
`src/lib/rate-limit.ts` uses `x-forwarded-for` or `x-real-ip` to identify the client. These headers can be spoofed by clients if the app is not behind a trusted proxy that overwrites them. An attacker could send a different IP per request and bypass the per-IP cronograma rate limit. **Recommendation:** When behind a trusted reverse proxy (e.g. Vercel), ensure the proxy sets and overwrites these headers; document that the app trusts them. For production at scale, use a Redis-backed rate limiter (e.g. @upstash/ratelimit) and/or rate limit by session or API key for authenticated routes.

- **Where to look:** `src/lib/rate-limit.ts`; deploy/proxy config (Vercel, etc.). Docs (API.md or AGENTS.md) for “trusted proxy” and optional Redis.
- **Done when:** Document trust of X-Forwarded-For/X-Real-IP when behind proxy; if Redis added, cronograma uses it and doc updated.

**No rate limiting on auth and sensitive endpoints**  
Login (`/api/auth/*`), admin bootstrap (`POST /api/admin/auth`), and user search (`GET /api/users/search`) are not rate limited. This allows brute-force attempts on credentials (admin bootstrap with body username/password) and user enumeration or harvesting via search. **Recommendation:** Add rate limiting (per IP and/or per session) for `POST /api/admin/auth` (strict) and optionally for login and user search. Use the same strategy as cronograma (or Redis) and document in API.md.

- **Where to look:** `src/lib/rate-limit.ts` (extend or add helpers); `src/app/api/admin/auth/route.ts`; optionally `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/users/search/route.ts`.
- **Done when:** Admin auth POST is rate limited; optional login/search limits as chosen. docs/API.md updated.

**Inconsistent request body validation**  
Several API routes parse JSON bodies with ad-hoc checks instead of Zod (e.g. groups POST, schedules POST, configuration days/priorities/roles PUT/PATCH, admin groups PATCH, collaborators POST, members POST/PUT, admin auth, admin users PUT, holidays POST). This can lead to missing validation, wrong types, or prototype pollution. **Recommendation:** Use Zod schemas and `parseBody(schema, body)` (or equivalent) for all mutable request bodies; add schemas in `src/lib/schemas/` where missing. Align with AGENTS.md "Request validation."

- **Where to look:** `src/lib/schemas/` (existing schemas); `src/lib/api-helpers.ts` (`parseBody`); each route listed above under `src/app/api/`.
- **Done when:** Every POST/PUT/PATCH body validated via Zod + parseBody; 400 with first issue message for invalid payloads. Can be done route-by-route; document in API.md when complete.

---

## Libraries (recommended)

| Area                | Library                                                              | Purpose                                                            |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Validation + types  | **Zod**                                                              | Request/response schemas, shared client–server types               |
| Forms               | **React Hook Form** + **@hookform/resolvers**                        | Consistent forms, dirty state, Zod integration                     |
| Client data         | **TanStack Query** (React Query)                                     | Caching, loading/error, refetch on focus, mutations + invalidation |
| Rate limiting       | **@upstash/ratelimit**                                               | Redis-backed rate limit for public cronograma (Vercel-friendly)     |
| Modals / a11y       | **Radix UI** (e.g. `@radix-ui/react-dialog`) or **focus-trap-react** | Focus trap, aria, keyboard for dialogs                             |
| Skeletons           | **Radix UI** `@radix-ui/react-skeleton` or Tailwind `animate-pulse`  | Loading placeholders that match final layout, reduce layout shift  |
| E2E tests           | **Playwright**                                                       | Critical path: sign in → create group → … → view cronograma        |
| My assignments      | **Google Calendar API** (googleapis)                                 | Save assignments to user's Google Calendar                         |
| Export PDF          | **@react-pdf/renderer**                                              | React → PDF for schedule or “my assignments” PDF                   |
| Keyboard shortcuts  | **react-hotkeys-hook**                                               | Declarative shortcuts and “quick jump” in config                   |
| In-app toasts       | **Sonner**                                                           | Success/error toasts after mutations                               |
| Email (optional)    | **Resend** or **SendGrid**                                           | Notifications (“you’re assigned”, “schedule ready”)                |
| PWA                 | **next-pwa** or manual `manifest.json`                               | Add to home screen for public cronograma                           |
| Tooltips (optional) | **Radix UI** `@radix-ui/react-tooltip`                               | Inline help on config labels                                       |
| Bundle analysis     | **@next/bundle-analyzer**                                            | Inspect bundle size when adding dependencies                       |
| Component docs      | **Storybook** (optional)                                             | Isolate and document shared components                             |

Install only what you need for the phase you’re implementing. Dependencies: Zod and TanStack Query are used across multiple sections; React Hook Form + resolvers go with Zod when introducing shared forms.

---

## 1. Library usage and standards

Findings from auditing current dependencies against recommended or standard usage. Address when touching the relevant areas.

**TanStack Query**  
Config flows use `useConfigContext` (useQuery) and `refetchContext` (invalidation) correctly. The **home page** (`src/app/page.tsx`) and **admin page** (`src/app/admin/page.tsx`) still use manual `fetch` + `useState` + `useEffect` for groups and dashboard data. Recommended approach: use **useQuery** (and **useMutation** where appropriate) for all server state so the app benefits from caching, request deduplication, loading/error states, and refetch on focus. Align home and admin with the same pattern as config (e.g. `useQuery({ queryKey: ['groups'], queryFn: ... })`).

- **Where to look:** `src/app/page.tsx`, `src/app/admin/page.tsx`; `src/lib/config-queries.ts` and `src/components/QueryProvider.tsx` for pattern. **Done when:** Home and admin use useQuery/useMutation; no manual fetch+useState+useEffect for server data; loading/error handled.

**react-hotkeys-hook**  
Usage is appropriate: `enableOnFormTags: false` where shortcuts should not fire in inputs, and `mod+k` for config "Ir a…". Optional: set `preventDefault: true` for `mod+k` if browser default ever conflicts. The shortcuts help overlay (`?`) is a custom div with `role="dialog"`; for full a11y (focus trap, Escape) consider Radix Dialog (optional; §2 Modals already recommends Radix for new modals).

- **Where to look:** `src/components/KeyboardShortcuts.tsx`. **Done when:** No change required unless adding preventDefault or Radix Dialog for overlay.

**Zod** — No change needed. **Auth.js** — No change needed. **Radix UI Dialog** — No change needed. **Drizzle ORM** — No change needed.

---

## 2. Accessibility

**Skip link**  
Add a “Saltar al contenido” link at the top of `src/app/layout.tsx` (or AppNavBar), visible on focus, that moves focus to the main content. Ensure the target is the `<main>` landmark (config layout and SharedScheduleView already use `<main>`).

**Landmarks and headings**  
Ensure each page has a single logical `<main>` and an `<h1>` that describes the page (e.g. “Miembros,” “Cronograma de marzo 2026”). Avoid nested or duplicate mains; adjust if needed so the landmark tree is clear for screen readers.

**Cronograma grid semantics**  
The public schedule grid is complex. Add an `<h1>` with month/year (and optionally group name). Give the grid (or table) an `aria-label` or brief summary. If the structure is tabular, consider using a real `<table>` with `<th>` for day/role so screen readers can announce structure; otherwise keep consistent roles and labels for rows/columns.

- **Where to look:** `src/components/SharedScheduleView/`; cronograma page. **Done when:** Grid has aria-label/summary; h1 present; copy in `messages/es.json`.

**Modals**  
Use **Radix UI** `@radix-ui/react-dialog` for new modals (focus trap, aria, restore focus on close). If you prefer not to add Radix, use **focus-trap-react** (or **react-focus-on**) around existing modal markup. The date-detail modal in SharedScheduleView now uses Radix Dialog (`DateDetailModal.tsx`). Apply to any other modals that do not yet follow this pattern.

- **Where to look:** `src/components/SharedScheduleView/DateDetailModal.tsx` for reference; `src/components/ConfirmDialog.tsx`. **Done when:** All modals use Radix Dialog or focus trap; Escape closes and restores focus.

**No hardcoded copy**  
Move remaining hardcoded Spanish (e.g. “Cerrar,” “Ensayo” in SharedScheduleView components, month names if duplicated) into `messages/es.json` and use `useTranslations` / `t()`. Use next-intl plural rules where applicable (e.g. “1 día” vs “2 días”).

**Focus and contrast**  
Audit interactive elements for keyboard reachability and visible focus indicators. Verify text/background contrast (WCAG AA) for body text, labels, and disabled states in both themes.

- **Where to look:** Global CSS, Tailwind, theme tokens; interactive components. **Done when:** All focusable elements keyboard-reachable; focus ring visible; contrast meets AA.

---

## 3. Performance

**Cache public cronograma API**  
Public cronograma GET endpoints are read-heavy and unauthenticated. Add caching (e.g. Next.js `revalidate` on a route that uses fetch, or `unstable_cache` in `src/lib/public-schedule.ts` keyed by slug + year + month) so repeated reads do not hit the DB every time. Consider a short TTL (e.g. 60–300 seconds) and document cache behavior. When adding caching, also set **Cache-Control** or **ETag** / **Last-Modified** for the response (see §9 "Cache headers for public cronograma") so browsers and CDNs can cache appropriately.

- **Where to look:** `src/lib/public-schedule.ts`; `src/app/api/cronograma/[slug]/route.ts`, `.../[slug]/[year]/[month]/route.ts`. **Done when:** Repeated requests for same slug+year+month use cache; TTL documented.

**Optional: background job for heavy rebuild**  
If “Rebuild” or “Fill empty” can be slow for large groups, consider running the scheduler in a background job (e.g. queue + polling or server action with streaming) and show “Procesando…” until completion, so the request does not time out and the UI stays responsive.


---

## 4. Client data and forms

**Shared form and validation**  
Use **React Hook Form** with **@hookform/resolvers** and **Zod** for validation. Create a shared `<FormField>` (or use RHF’s `Controller` + your inputs) and consistent error display. Validate on the server with the same Zod schemas from `src/lib/schemas/`. Use for new and refactored forms so dirty state and the unsaved guard can rely on `formState.isDirty`.

**API types as contract**  
Define Zod schemas in `src/lib/schemas/` and use them in both API handlers (e.g. `schema.parse(body)`) and client (types from `z.infer<typeof schema>`). Optional later: **zod-to-openapi** for OpenAPI export and generated clients or docs.

**Optimistic updates**  
For non-destructive mutations (e.g. update note, reorder roles, toggle availability), use TanStack Query’s optimistic update pattern: update the cache immediately on mutation, then roll back on error and show a toast. Makes the UI feel instant and reduces perceived latency. Use sparingly where rollback is simple and conflicts are unlikely.

---

## 5. Product and UX clarity

**Guided first-time setup**  
After creating a group, show a short wizard or checklist: “Agregar miembro” → “Definir roles” → “Configurar eventos” → “Generar primer mes,” with links to the right config pages. Reuse existing routes; only add the checklist component and optional progress state (e.g. in group context or a small config landing block).

**Optional notifications**  
Optional: notify users when assigned or when a schedule is ready. Use **Resend** or **SendGrid** for email; use **Sonner** (or similar) for in-app toasts after mutations. For “schedule ready” or background notifications, a small queue (e.g. Inngest or a DB-backed job) can trigger the email.

**Share cronograma link**  
On the public cronograma page, add a “Copiar enlace” button that copies the current URL to the clipboard (and optionally shows a Sonner toast). Optional: “Compartir por correo” that opens a `mailto:` with pre-filled subject/body (e.g. “Cronograma de [mes] [año] – [grupo]”) so users can send the link in one click.

**Inline help and tooltips**  
Add optional tooltips or “?” icons next to config labels that need explanation (e.g. “Prioridades de roles por evento,” “Ventana horaria UTC”). Use Radix UI `@radix-ui/react-tooltip` or a small custom component. Link from empty states to a short help doc or in-app “Cómo empezar” so new users know what to do next.

---

## 6. Data and domain clarity

**Explicit draft vs published**  
If the intended flow is “edit schedule then publish,” make it explicit in the model or docs: e.g. `schedules.status` or `publishedAt`, and document that public cronograma reads only “published” or “latest committed.” If the current behavior is already “last saved = public,” document it in `docs/DATABASE.md` and AGENTS.md so future changes (e.g. version history) are easier.


**Optional: unify absence model**  
User holidays and member holidays could be one table with scope (user vs member). This is a larger refactor; only do if it simplifies code and UX (e.g. one “Add absence” flow with “for me” vs “for [member]” in group context). Otherwise, keep current model and document it.

**Optional: soft delete for members**  
Instead of hard-deleting members, add `deletedAt` and exclude deleted members from lists and scheduler; keep assignments referencing the member for historical schedules. Enables “restore” and avoids “can’t delete because of assignments” by treating past assignments as read-only history. Requires migration and updates to all member queries and scheduler.

---

## 7. Schedule and create-group flows

**Schedule detail: single PUT or clear batching**  
The schedule detail page (`src/app/[slug]/config/schedules/[id]/page.tsx`) issues many separate PUTs. Either: (1) support a single PUT with a structured body (e.g. `{ assignments?, notes?, ... }`) and “omit = leave unchanged,” or (2) keep multiple PUTs but introduce a small client abstraction and optional debounce so “save” is one logical action and partial failures are easier to handle.

**Create-group alignment**  
The create form only sends `name` and `slug` (`src/app/groups/new/page.tsx`); the API accepts `days`, `roles`, `collaboratorUserIds` (`src/app/api/groups/route.ts`). Either extend the UI with optional initial days/roles/collaborators and send them in the same POST, or simplify the API so POST only creates the group and the rest is done via existing config endpoints. Align UI and API so the same capabilities are available without duplication.

**Slug in URL for new-tab and refresh**  
Config detail pages (e.g. member edit, role edit) depend on `groupId` from GroupProvider. If the user opens a link in a new tab or refreshes, context may be missing. Ensure all config URLs include the slug (e.g. `/[slug]/config/members/[id]`) and that the page can resolve group from the URL (e.g. via server layout or the slug-accepting API above) so “open in new tab” and refresh work without in-memory context.

**Schedule editing UX**  
In the schedule detail view, allow inline edit of assignments where possible: e.g. click a cell → dropdown or modal to change the assigned member (same data as today, fewer clicks). Optional: “Intercambiar” to swap two assignments on the same date, or use a drag-and-drop library for reassignment. When adding a new month, offer “Usar asignaciones del mes anterior como base” (copy from previous month) so the user can tweak instead of starting from scratch—complements “Fill empty” and “Rebuild.”

**Bulk actions**  
Support bulk add members: e.g. paste a list of names (one per line or comma-separated) and create multiple members in one step; or “Duplicar evento” to copy an existing recurring event to another weekday with the same type/label/times. Bulk edit availability (e.g. “Marcar estos miembros como disponibles los miércoles”) can be a later enhancement. Keeps the same features; reduces repetitive form submissions.

**Group template / duplicate group**  
Allow “Duplicar grupo” (or “Crear grupo desde plantilla”): copy the current group’s structure—recurring events, roles, exclusive groups, event role priorities—into a new group with a new name/slug; do not copy members or schedules. Lets users spin up a similar group (e.g. “Banda A” → “Banda B”) without re-entering all config. Add endpoint `POST /api/groups` with body `{ name, slug, duplicateFromGroupId }` and a button on the group config landing or in the group list.

---

## 8. Operations, audit, and quality

**Config audit log**  
Extend the audit idea from `schedule_audit_log` in `src/db/schema.ts` to config changes: who changed members, roles, events, collaborators, or group settings. Add a table (e.g. `config_audit_log` or generic `audit_events`) and log mutations from the relevant API routes. Useful for accountability and debugging.

**Backup / export group data**  
Allow group owners (or admins) to export group data (members, roles, events, schedules, assignments) as JSON. Add an endpoint (e.g. `GET /api/groups/[id]/export` with auth and group access) and optionally an “Import from backup” flow later. Document in API.md.

**E2E critical path**  
Add **Playwright** and an E2E test for the main journey: sign in → create group → add member → add role → add event → generate schedule → view public cronograma. Use Playwright’s Next.js-friendly patterns (e.g. `baseURL`, `page.goto`). Run on CI so refactors do not break the core flow.

**Seeded “big” group**  
Implemented via **unified seed** `scripts/seed.ts`: solo artists, jazz trio, two rock bands, and an orchestra. Use it for performance testing (scheduler, public cronograma, config lists) and manual QA. Run: `npm run seed -- --user=<UUID>` (see scripts/CONTEXT.md).

**Staging parity**  
Keep a staging environment that mirrors production (same auth provider and DB shape) so full flows (OAuth, member linking, cronograma sharing) can be tested before release.

**Optional: health/readiness endpoint**  
Add a simple `GET /api/health` or `GET /api/ready` that checks DB connectivity (and optionally auth) for load balancers or monitoring. No business logic.

**List filtering and sorting**  
On config list pages (members, roles, schedules, events), add optional filter and sort: e.g. search members by name/email, sort schedules by month descending, sort members by name. Use existing API with query params (e.g. `?q=`, `?sort=name`) or extend responses; keep the UI simple (single input or dropdown). Makes large groups easier to manage.

**API versioning**  
Document a strategy for future breaking changes: e.g. prefix routes with `/api/v1/` when you introduce a new contract, or commit to backward-compatible additions only and document deprecation windows. No immediate code change required; add a short “Versioning” subsection to API.md so future changes are consistent.

**Bundle analysis**  
Add **@next/bundle-analyzer** (or similar) and run it on demand or in CI (e.g. `ANALYZE=true npm run build`) to catch bundle bloat when adding libraries. Helps keep the client bundle small, especially after adding TanStack Query, React Hook Form, and Radix.

**Locale readiness**  
Keep all user-facing strings in `messages/es.json` and use next-intl plural and date formatting everywhere. Document in AGENTS.md or docs how to add a new locale (copy `es.json` → `en.json`, translate, add locale to next-intl config) so adding another language later is straightforward. No second locale required now; just readiness.

---

## 9. Additional polish

**PWA / “add to home screen”**  
Use **next-pwa** (Workbox-based) or add a manual `manifest.json` and a minimal service worker for the public cronograma so users can “add to home screen” on mobile. Document in CLIENT.md.

**Respect prefers-color-scheme**  
Ensure the existing theme toggle and default theme respect `prefers-color-scheme` so first-time visitors get their system preference. Check layout and any theme provider.

**Cache headers for public cronograma**  
When adding caching (see section 3), consider `Cache-Control` or `ETag` / `Last-Modified` for the public cronograma response so browsers and CDNs can cache appropriately. Invalidate or shorten TTL when the schedule is updated (e.g. via `updatedAt` on the schedule row).

**Offline and resilience**  
With the PWA service worker (above), cache the public cronograma response for the current month so returning visitors can view it offline. Rely on TanStack Query’s default retry for failed API calls; optionally add exponential backoff for config routes so temporary network issues don’t immediately show an error. Improves perceived reliability without changing features.

**Touch and mobile**  
Audit tap targets: ensure buttons and links meet a minimum touch size (e.g. 44px) on mobile. On the public cronograma, consider swipe left/right to change month (in addition to prev/next buttons) so mobile users can navigate with one hand. Document in CLIENT.md if you add gesture handling.

---

## 10. More product and DX ideas

**Component library / Storybook (optional)**  
Add **Storybook** (or similar) for shared components: LoadingScreen, OptionToggleGroup, form fields, empty states, dialogs. Enables visual regression and safer refactors when changing SharedScheduleView or design tokens. Optional; useful once the component set stabilizes.

**Changelog or “What’s new”**  
Keep a **CHANGELOG.md** in the repo (and optionally a short “Qué hay de nuevo” in-app modal or link after deployments) so users and contributors see improvements over time. No feature change; improves transparency.

**Optional: import public holidays**  
Allow users (or group config) to import a set of country/region holidays (e.g. from a public calendar or a curated list) so common non-working days are pre-filled. User/member can still add personal absences on top. Keeps the same absence model; reduces data entry for known holidays.

**Optional: conflict hints when assigning**  
When manually editing assignments in the schedule detail view, show a subtle hint if the selected member already has an assignment that day in another group (dashboard conflict data). Doesn’t block the assignment; just informs. Reuses existing conflict logic from the dashboard.

---

## 11. Simpler usage and new product ideas

Ideas to reduce friction for common tasks and potential new capabilities, based on the app’s purpose (group scheduling: members, roles, recurring events, assignments).

### Simpler usage

**Default or copied availability for new members**  
When adding a member, require explicit availability for all seven weekdays. Offer a default (e.g. “Disponible todos los días” or “Solo fines de semana”) or “Copiar disponibilidad de [miembro]” so coordinators can clone a similar member’s grid and tweak. Reduces repetitive clicking on the availability grid.

**Persist Mis asignaciones filters**  
Remember the user’s last filter choices (group, year, month, role) in sessionStorage or URL (e.g. `?groupId=&year=&month=`). On next visit, restore them so returning users don’t have to reselect. Optional: preset chips like “Este mes”, “Próximos 3 meses”.

**“Copy from previous month” when adding a schedule month**  
When creating a new schedule month, offer “Usar asignaciones del mes anterior como base” (in addition to “Fill empty” and “Rebuild”). Copy assignments from the previous month so coordinators can adjust instead of starting from scratch. Complements existing §7 “Schedule editing UX” idea.

**Bulk set availability by weekday**  
On the member list or a dedicated “Disponibilidad” view, allow “Marcar [estos miembros] como disponibles el [día]” so one action sets one weekday for many members. Reduces repeated edits when many people share the same pattern.

**Quick-start group template**  
After “Crear grupo”, offer an optional “Empezar con plantilla”: e.g. “Banda / ministerio” (one assignable event, 2–3 roles) or “Grupo pequeño” (one event, 1 role). Creates minimal config so the user can add members and generate the first month in fewer steps. Can reuse §7 “Group template / duplicate group” for predefined templates.

**Inline “suggest assignee” in schedule detail**  
When editing an assignment cell, show a short list of suggested members (e.g. by availability, role, and recent load) so the coordinator can pick with one click instead of opening a long dropdown. Read-only suggestion; user can still pick anyone.

### New features

**Export to iCal / .ics or CalDAV**  
Besides “Guardar en Google Calendar”, allow “Descargar .ics” (or “Añadir a Apple Calendar / Outlook”) so users without Google can import assignments. Reuse the same assignment data as the Google flow; generate a one-off or recurring .ics feed. Document in API.md and CLIENT.md.

**PDF export of cronograma or Mis asignaciones**  
Allow “Descargar PDF” on the public cronograma (for a month) or on Mis asignaciones (filtered list). Use **@react-pdf/renderer** (already in §Libraries). Useful for printing or sharing without link access.

**Assignment balance / fairness report**  
A simple report per group (e.g. under Config or Cronograma): “Asignaciones por miembro” (count per member for a date range) or “Carga del mes”. Helps coordinators see who is over/under assigned and adjust manually or in a future “balance” algorithm. No schema change if using existing assignment counts.

**Swap or leave request (optional)**  
Allow a member to request “No puedo este día” or “Intercambiar con alguien” for a specific assignment. Store requests (new table or JSON); notify coordinator or the other member. Accept/decline flow. Larger feature; consider after core UX is stable.

**Optional private cronograma link**  
For sensitive groups, support “Enlace privado”: cronograma only visible with a secret token in the URL (e.g. `/[slug]/cronograma/[year]/[month]?token=...`). Group setting “Requerir token para ver cronograma”; share link with token. Requires storing and validating a token per group.

**Reminder or digest (email)**  
Optional “Recordatorio semanal” or “Resumen de asignaciones”: email (Resend/SendGrid) to linked members with their assignments for the upcoming week or month. Opt-in per user or per group. Complements §5 “Optional notifications”.

**Substitutes or backup list per role**  
Allow marking some members as “sustituto” for a role (or a separate “backup” list per role). Scheduler could prefer or fall back to substitutes when the primary is unavailable. Requires schema/UX for substitute vs primary; can start as a simple “backup role” or tag.

**Confirmación de asistencia (optional)**  
After assignments are published, let assignees confirm “Confirmo que asistiré” (checkbox or link). Store confirmation per assignment; show in schedule detail or in a small report. Helps coordinators know who to chase. New table or column on `schedule_date_assignments`.

### Conflicts and availability

Ways to prevent, surface, and resolve conflicts (cross-group, holidays, availability) so coordinators and members can act on them.

**Cross-group conflicts (same date, multiple groups)**  
Today the dashboard and Mis asignaciones show “Conflicto: múltiples grupos en esta fecha” but do not prevent or guide resolution.

- **Warn or block when assigning:** In schedule detail, when the coordinator picks a member for a date, check if that member (if linked to a user) already has an assignment that day in another group. Show a warning (“Este miembro ya está asignado en [Grupo X] este día”) or optionally block saving. Reuse dashboard conflict logic; consider a group setting “Solo advertir” vs “Bloquear asignaciones con conflicto”.
- **Make conflicts actionable:** On Inicio and Mis asignaciones, turn conflict lines into links: e.g. “Ver en cronograma” for each group, or “Ir a [Grupo A] / [Grupo B]” so the user can open both and decide. Optional: “Sugerir intercambio” using members who are free that day in one of the groups.
- **Notify when a conflict is created:** After saving an assignment that creates a new cross-group conflict for that member, show an in-app toast or optional email to the linked user: “Tienes dos asignaciones el [fecha]: [Grupo A], [Grupo B].”

**Holiday conflicts (assignment on a date when member/user is on holiday)**  
Today `getHolidayConflicts` is used and conflicts are shown with ⚠ in the cronograma and schedule detail.

- **Warn when assigning:** When the coordinator selects a member for a date, check if that member (or linked user) has a holiday covering that date. Show “Atención: [Miembro] tiene ausencia registrada este día” before or after save. Reduces accidental assignments that will show as conflicts later.
- **“Revalidar cronograma” or conflict report:** Add a button on the schedule detail page (e.g. “Comprobar vacaciones”) that runs the same holiday-conflict check and lists all assignments that conflict with current holidays, with links to the date or to edit the member’s holidays. No schema change; reuses `getHolidayConflicts`.

**Availability conflicts (assignment on a weekday the member is no longer available)**  
The scheduler respects current availability when generating; existing assignments are not rechecked when a member’s availability or event time window changes. Assignments can become “invalid” without any indicator.

- **Detect and show availability conflicts:** Similar to holiday conflicts: for each assignment, check whether the member’s current availability (and event time window, if any) allows that weekday/time. Add `getAvailabilityConflicts(entries, groupId)` (or extend a generic “schedule conflicts” helper) and return entries where the member is no longer available. Show these in schedule detail and in SharedScheduleView with a distinct indicator (e.g. “Fuera de disponibilidad” ⚠ or icon). Reuses `member_availability` and event time windows; no new tables if computed on read.
- **“Revalidar cronograma” for all conflict types:** A single “Comprobar conflictos” or “Revalidar” action on the schedule: run cross-group (for linked members), holiday, and availability checks; show a summary (e.g. “3 con vacaciones, 2 fuera de disponibilidad”) and a list with links to each date or member. Optionally “Reasignar solo los conflictivos” (run scheduler for those dates only) as in §7 “Fill empty”.
- **When editing member availability:** After saving a member’s availability, show “Asignaciones afectadas: [fechas] en [Mes A], [Mes B]” with links to those schedule months so the coordinator can fix or revalidate. Requires querying existing assignments for that member and comparing weekday + optional time window to new availability.

**Central place for conflict types**  
Use consistent wording and icons for the three sources (cross-group, holiday, availability) in dashboard, Mis asignaciones, schedule detail, and cronograma. Consider a small “Leyenda” or tooltip: “⚠ = vacaciones” vs “⚠ = fuera de disponibilidad” vs “Conflicto entre grupos”. Helps coordinators and members interpret and act on each type.

- **Implementation (conflicts):** Cross-group: reuse dashboard conflict logic in `src/app/api/user/dashboard/route.ts`; schedule detail `src/app/[slug]/config/schedules/[id]/page.tsx`. Holiday: `src/lib/holiday-conflicts.ts`; add "Comprobar vacaciones" button. Availability: new helper using `member_availability` + event time windows; return from schedule API; show in SharedScheduleView and schedule detail. Legend/tooltip in `messages/es.json`.

---

## Suggested order of implementation

- **Library standards (§1):** Address TanStack Query on home/admin when touching those pages.
- **Phase 1 (Server and data):** Server group resolution.
- **Phase 2 (A11y and perf):** Skip link + landmarks, cronograma grid semantics, move hardcoded strings, cache public API.
- **Phase 3 (Product and ops):** Draft/published docs, guided setup + My assignments, shared forms, audit log + export, E2E + seed.
- **§11 Simpler usage and new features:** Pick items from section 11 (e.g. persist Mis asignaciones filters, copy from previous month, iCal/PDF export, balance report) as product priorities; no hard dependency on earlier phases. For **conflicts and availability** (§11), start with “Revalidar cronograma” (holiday + availability) and cross-group warn-when-assigning; then make conflicts actionable and add availability conflict detection.

*Loading, errors, empty states, and unsaved banner (formerly Phase 1) are done; see AGENTS.md Features.*

You can implement individual items out of order (e.g. skip link and cache before server resolution) where there are no hard dependencies. When adding libraries, install only those needed for the phase (e.g. Phase 2: Radix or focus-trap-react; Phase 3: React Hook Form, @hookform/resolvers, Playwright, googleapis, @react-pdf/renderer as needed).

---

## Docs to update as you go

**When implementing any roadmap item:** (1) Use the **Quick reference** table above to find key files for that section. (2) If the item has no explicit "Where to look", infer from the section text and Quick reference. (3) "Done when" = the recommendation in the item is satisfied; run `npm run lint` and `npm run build`. (4) Update the docs below as applicable.

- **docs/API.md:** New endpoints (export, health), any further route changes.
- **docs/CLIENT.md:** New pages (e.g. “My assignments”), loading/error boundaries, any new nav or shortcuts, share link, touch/swipe behavior.
- **docs/DATABASE.md:** New tables (audit), draft/published semantics, glossary reference.
- **AGENTS.md:** New features list, domain glossary, any new scripts or conventions, a short note on new dependencies (Zod, TanStack Query, React Hook Form, etc.), and how to add a new locale.
- **CHANGELOG.md:** Optional; list notable changes per release for users and contributors.
