# Cronogramas improvement roadmap

A consolidated roadmap to improve Cronogramas across API design, security, performance, accessibility, UX, product clarity, and maintainability—while preserving all existing features.

This plan groups improvements into themes. Each theme can be implemented independently or in sequence; dependencies are noted where relevant. Use this doc to pick and tackle items week by week.

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
| Export iCal         | **ical-generator**                                                   | Generate .ics for “my assignments” export                          |
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

## 2. Loading, errors, and empty states

**Loading skeletons**  
Prefer **skeletons** over a full-page spinner wherever the final layout is predictable: they reduce perceived wait and make the app feel faster. Use Next.js `loading.tsx` for route-level suspension (navigation shows the skeleton immediately), and optionally inline skeletons inside pages that fetch after mount (e.g. with TanStack Query’s `isLoading`).

- **Reusable primitives:** Add a small set of shared components (e.g. `SkeletonCard`, `SkeletonRow`, `SkeletonText`, `SkeletonGrid`) in `src/components/` or under a `Skeletons` folder. Use **Radix UI** `@radix-ui/react-skeleton` or a simple div with Tailwind `animate-pulse` and `rounded bg-muted` so all skeletons share the same look and respect theme. Reuse across routes for consistency.
- **Per route:**
  - **Dashboard (/):** Skeleton cards for “next assignment” and group list (e.g. 3–4 card-shaped blocks); calendar area as a simple grid or placeholder so the page doesn’t jump when data loads.
  - **Config layout / list pages:** Skeleton for the sub-nav (breadcrumb/group name) plus list skeletons—e.g. table rows for members/roles/schedules (one row = avatar/icon + 2–3 text lines) or card rows for events. Match approximate height/count (e.g. 5–6 rows) to avoid big layout shift.
  - **Cronograma (public):** Skeleton that mirrors the schedule grid: month header + week rows with cell placeholders (same column/row structure as `SharedScheduleView`) so when data loads the transition is minimal.
  - **Schedule detail:** Skeleton for the main grid plus sidebar/notes area if the layout has one; same idea—approximate final layout to avoid shift.
- **When to use a spinner instead:** Full-page spinner (or existing `LoadingScreen`) is fine for auth redirects, first load of a heavy single-purpose page, or when the layout is truly unknown. Prefer skeletons for any route where you know the structure (lists, grids, dashboard).
- **Accessibility:** Wrap skeleton regions in a container with `aria-busy="true"` and `aria-label` (e.g. “Cargando…”) so screen readers announce loading; remove or replace with the real content when data is ready. Keep skeleton markup minimal (decorative) so it’s not read as real content.

**Route-level loading UI**  
Add `loading.tsx` for key segments (e.g. `[slug]/config`, cronograma, and optionally dashboard) so navigation shows the skeleton (or spinner) immediately instead of a blank screen. Export a default component that renders the appropriate skeleton for that segment (e.g. config layout skeleton vs cronograma grid skeleton). Reuse or extend `LoadingScreen` only where a full-page spinner is still the right choice (e.g. login redirect).

**Error boundaries**  
There are no `error.tsx` boundaries. Add at least one at the root or layout level (e.g. `src/app/error.tsx` or under `[slug]/config` and cronograma) that catches runtime and fetch errors, shows a clear message and a “Reintentar” / “Volver” action, and optionally reports or logs.

**Empty states**  
For “no members,” “no roles,” “no schedules,” “no events,” add explicit empty-state components with short copy and a primary CTA (e.g. “Agregar miembro,” “Crear primer cronograma”). Use consistent placement and styling across config pages.


**Unsaved changes UX**  
Keep `UnsavedConfigProvider` and the nav guard. Add: (1) a visible banner when `dirty` is true (“Tienes cambios sin guardar”); (2) optional `beforeunload` when config is dirty so closing the tab warns the user. When you add **Sonner** (section 7), use it for “Guardado” / “Error al guardar” after form submit so feedback is consistent.

---

## 3. Accessibility

**Skip link**  
Add a “Saltar al contenido” link at the top of `src/app/layout.tsx` (or AppNavBar), visible on focus, that moves focus to the main content. Ensure the target is the `<main>` landmark (config layout and SharedScheduleView already use `<main>`).

**Landmarks and headings**  
Ensure each page has a single logical `<main>` and an `<h1>` that describes the page (e.g. “Miembros,” “Cronograma de marzo 2026”). Avoid nested or duplicate mains; adjust if needed so the landmark tree is clear for screen readers.

**Cronograma grid semantics**  
The public schedule grid is complex. Add an `<h1>` with month/year (and optionally group name). Give the grid (or table) an `aria-label` or brief summary. If the structure is tabular, consider using a real `<table>` with `<th>` for day/role so screen readers can announce structure; otherwise keep consistent roles and labels for rows/columns.

**Modals**  
Use **Radix UI** `@radix-ui/react-dialog` for new modals (focus trap, aria, restore focus on close). If you prefer not to add Radix, use **focus-trap-react** (or **react-focus-on**) around existing modal markup. Apply to the date-detail modal in SharedScheduleView and any confirm dialogs that do not yet follow this pattern.

**No hardcoded copy**  
Move remaining hardcoded Spanish (e.g. “Cerrar,” “Ensayo” in SharedScheduleView, month names if duplicated) into `messages/es.json` and use `useTranslations` / `t()`. Use next-intl plural rules where applicable (e.g. “1 día” vs “2 días”).

**Focus and contrast**  
Audit interactive elements for keyboard reachability and visible focus indicators. Verify text/background contrast (WCAG AA) for body text, labels, and disabled states in both themes.

---

## 4. Performance

**Cache public cronograma API**  
Public cronograma GET endpoints are read-heavy and unauthenticated. Add caching (e.g. Next.js `revalidate` on a route that uses fetch, or `unstable_cache` in `src/lib/public-schedule.ts` keyed by slug + year + month) so repeated reads do not hit the DB every time. Consider a short TTL (e.g. 60–300 seconds) and document cache behavior.

**Split SharedScheduleView**  
`src/components/SharedScheduleView.tsx` is very large (~1.4k lines). Split into smaller components (e.g. month header, week rows, date cell, date detail modal). When extracting the date-detail modal, consider **Radix UI Dialog** for consistent a11y. Keep the same public interface so callers do not change.

**Optional: background job for heavy rebuild**  
If “Rebuild” or “Fill empty” can be slow for large groups, consider running the scheduler in a background job (e.g. queue + polling or server action with streaming) and show “Procesando…” until completion, so the request does not time out and the UI stays responsive.


---

## 5. Client data and forms

**Shared form and validation**  
Use **React Hook Form** with **@hookform/resolvers** and **Zod** for validation. Create a shared `<FormField>` (or use RHF’s `Controller` + your inputs) and consistent error display. Validate on the server with the same Zod schemas from `src/lib/schemas/`. Use for new and refactored forms so dirty state and the unsaved guard can rely on `formState.isDirty`.

**API types as contract**  
Define Zod schemas in `src/lib/schemas/` and use them in both API handlers (e.g. `schema.parse(body)`) and client (types from `z.infer<typeof schema>`). Optional later: **zod-to-openapi** for OpenAPI export and generated clients or docs.

**Optimistic updates**  
For non-destructive mutations (e.g. update note, reorder roles, toggle availability), use TanStack Query’s optimistic update pattern: update the cache immediately on mutation, then roll back on error and show a toast. Makes the UI feel instant and reduces perceived latency. Use sparingly where rollback is simple and conflicts are unlikely.

---

## 6. Product and UX clarity

**Guided first-time setup**  
After creating a group, show a short wizard or checklist: “Agregar miembro” → “Definir roles” → “Configurar eventos” → “Generar primer mes,” with links to the right config pages. Reuse existing routes; only add the checklist component and optional progress state (e.g. in group context or a small config landing block).

**Optional notifications**  
Optional: notify users when assigned or when a schedule is ready. Use **Resend** or **SendGrid** for email; use **Sonner** (or similar) for in-app toasts after mutations. For “schedule ready” or background notifications, a small queue (e.g. Inngest or a DB-backed job) can trigger the email.

**Share cronograma link**  
On the public cronograma page, add a “Copiar enlace” button that copies the current URL to the clipboard (and optionally shows a Sonner toast). Optional: “Compartir por correo” that opens a `mailto:` with pre-filled subject/body (e.g. “Cronograma de [mes] [año] – [grupo]”) so users can send the link in one click.

**Inline help and tooltips**  
Add optional tooltips or “?” icons next to config labels that need explanation (e.g. “Prioridades de roles por evento,” “Ventana horaria UTC”). Use Radix UI `@radix-ui/react-tooltip` or a small custom component. Link from empty states to a short help doc or in-app “Cómo empezar” so new users know what to do next.

---

## 7. Data and domain clarity

**Explicit draft vs published**  
If the intended flow is “edit schedule then publish,” make it explicit in the model or docs: e.g. `schedules.status` or `publishedAt`, and document that public cronograma reads only “published” or “latest committed.” If the current behavior is already “last saved = public,” document it in `docs/DATABASE.md` and AGENTS.md so future changes (e.g. version history) are easier.

**Domain glossary**  
Add a short glossary to AGENTS.md (or DATABASE.md): “event” = recurring weekday config, “schedule date” = concrete date in a schedule, “assignment” = member-role on a date. Use this vocabulary consistently in schema, API, and UI labels.

**Optional: unify absence model**  
User holidays and member holidays could be one table with scope (user vs member). This is a larger refactor; only do if it simplifies code and UX (e.g. one “Add absence” flow with “for me” vs “for [member]” in group context). Otherwise, keep current model and document it.

**Optional: soft delete for members**  
Instead of hard-deleting members, add `deletedAt` and exclude deleted members from lists and scheduler; keep assignments referencing the member for historical schedules. Enables “restore” and avoids “can’t delete because of assignments” by treating past assignments as read-only history. Requires migration and updates to all member queries and scheduler.

---

## 8. Schedule and create-group flows

**Schedule detail: single PUT or clear batching**  
The schedule detail page (`src/app/[slug]/config/schedules/[id]/page.tsx`) issues many separate PUTs. Either: (1) support a single PUT with a structured body (e.g. `{ assignments?, notes?, ... }`) and “omit = leave unchanged,” or (2) keep multiple PUTs but introduce a small client abstraction and optional debounce so “save” is one logical action and partial failures are easier to handle.

**Create-group alignment**  
The create form only sends `name` and `slug` (`src/app/groups/new/page.tsx`); the API accepts `days`, `roles`, `collaboratorUserIds` (`src/app/api/groups/route.ts`). Either extend the UI with optional initial days/roles/collaborators and send them in the same POST, or simplify the API so POST only creates the group and the rest is done via existing config endpoints. Align UI and API so the same capabilities are available without duplication.

**Slug in URL for new-tab and refresh**  
Config detail pages (e.g. member edit, role edit) depend on `groupId` from GroupProvider. If the user opens a link in a new tab or refreshes, context may be missing. Ensure all config URLs include the slug (e.g. `/[slug]/config/members/[id]`) and that the page can resolve group from the URL (e.g. via server layout or the slug-accepting API above) so “open in new tab” and refresh work without in-memory context.

**Schedule editing UX**  
In the schedule detail view, allow inline edit of assignments where possible: e.g. click a cell → dropdown or modal to change the assigned member (same data as today, fewer clicks). Optional: “Intercambiar” to swap two assignments on the same date, or use **@dnd-kit** (already in the project for column order) for drag-and-drop reassignment. When adding a new month, offer “Usar asignaciones del mes anterior como base” (copy from previous month) so the user can tweak instead of starting from scratch—complements “Fill empty” and “Rebuild.”

**Bulk actions**  
Support bulk add members: e.g. paste a list of names (one per line or comma-separated) and create multiple members in one step; or “Duplicar evento” to copy an existing recurring event to another weekday with the same type/label/times. Bulk edit availability (e.g. “Marcar estos miembros como disponibles los miércoles”) can be a later enhancement. Keeps the same features; reduces repetitive form submissions.

**Group template / duplicate group**  
Allow “Duplicar grupo” (or “Crear grupo desde plantilla”): copy the current group’s structure—recurring events, roles, exclusive groups, event role priorities—into a new group with a new name/slug; do not copy members or schedules. Lets users spin up a similar group (e.g. “Banda A” → “Banda B”) without re-entering all config. Add endpoint `POST /api/groups` with body `{ name, slug, duplicateFromGroupId }` and a button on the group config landing or in the group list.

---

## 9. Operations, audit, and quality

**Config audit log**  
Extend the audit idea from `schedule_audit_log` in `src/db/schema.ts` to config changes: who changed members, roles, events, collaborators, or group settings. Add a table (e.g. `config_audit_log` or generic `audit_events`) and log mutations from the relevant API routes. Useful for accountability and debugging.

**Backup / export group data**  
Allow group owners (or admins) to export group data (members, roles, events, schedules, assignments) as JSON. Add an endpoint (e.g. `GET /api/groups/[id]/export` with auth and group access) and optionally an “Import from backup” flow later. Document in API.md.

**E2E critical path**  
Add **Playwright** and an E2E test for the main journey: sign in → create group → add member → add role → add event → generate schedule → view public cronograma. Use Playwright’s Next.js-friendly patterns (e.g. `baseURL`, `page.goto`). Run on CI so refactors do not break the core flow.

**Seeded “big” group**  
Add a seed or script that creates a group with many members, roles, events, and months of schedules. Use it for performance testing (scheduler, public cronograma, config lists) and manual QA.

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

## 10. Additional polish

**PWA / “add to home screen”**  
Use **next-pwa** (Workbox-based) or add a manual `manifest.json` and a minimal service worker for the public cronograma so users can “add to home screen” on mobile. Document in CLIENT.md.

**Respect prefers-color-scheme**  
Ensure the existing theme toggle and default theme respect `prefers-color-scheme` so first-time visitors get their system preference. Check layout and any theme provider.

**Cache headers for public cronograma**  
When adding caching (see section 5), consider `Cache-Control` or `ETag` / `Last-Modified` for the public cronograma response so browsers and CDNs can cache appropriately. Invalidate or shorten TTL when the schedule is updated (e.g. via `updatedAt` on the schedule row).

**Offline and resilience**  
With the PWA service worker (above), cache the public cronograma response for the current month so returning visitors can view it offline. Rely on TanStack Query’s default retry for failed API calls; optionally add exponential backoff for config routes so temporary network issues don’t immediately show an error. Improves perceived reliability without changing features.

**Touch and mobile**  
Audit tap targets: ensure buttons and links meet a minimum touch size (e.g. 44px) on mobile. On the public cronograma, consider swipe left/right to change month (in addition to prev/next buttons) so mobile users can navigate with one hand. Document in CLIENT.md if you add gesture handling.

---

## 11. More product and DX ideas

**Component library / Storybook (optional)**  
Add **Storybook** (or similar) for shared components: LoadingScreen, OptionToggleGroup, form fields, empty states, dialogs. Enables visual regression and safer refactors when splitting SharedScheduleView or changing design tokens. Optional; useful once the component set stabilizes.

**Changelog or “What’s new”**  
Keep a **CHANGELOG.md** in the repo (and optionally a short “Qué hay de nuevo” in-app modal or link after deployments) so users and contributors see improvements over time. No feature change; improves transparency.

**Optional: import public holidays**  
Allow users (or group config) to import a set of country/region holidays (e.g. from a public calendar or a curated list) so common non-working days are pre-filled. User/member can still add personal absences on top. Keeps the same absence model; reduces data entry for known holidays.

**Optional: conflict hints when assigning**  
When manually editing assignments in the schedule detail view, show a subtle hint if the selected member already has an assignment that day in another group (dashboard conflict data). Doesn’t block the assignment; just informs. Reuses existing conflict logic from the dashboard.

---

## Suggested order of implementation

- **Phase 1 (UX and resilience):** loading.tsx + error.tsx, empty states, unsaved banner + beforeunload.
- **Phase 2 (Server and data):** Server group resolution.
- **Phase 3 (A11y and perf):** Skip link + landmarks, cronograma grid semantics, move hardcoded strings, cache public API, split SharedScheduleView.
- **Phase 4 (Product and ops):** Glossary + draft/published docs, guided setup + My assignments, shared forms, audit log + export, E2E + seed.

You can implement individual items out of order (e.g. skip link and cache before server resolution) where there are no hard dependencies. When adding libraries, install only those needed for the phase (e.g. Phase 3: Radix or focus-trap-react; Phase 4: React Hook Form, @hookform/resolvers, Playwright, ical-generator, @react-pdf/renderer as needed).

---

## Docs to update as you go

- **docs/API.md:** New endpoints (export, health), any further route changes.
- **docs/CLIENT.md:** New pages (e.g. “My assignments”), loading/error boundaries, any new nav or shortcuts, share link, touch/swipe behavior.
- **docs/DATABASE.md:** New tables (audit), draft/published semantics, glossary reference.
- **AGENTS.md:** New features list, domain glossary, any new scripts or conventions, a short note on new dependencies (Zod, TanStack Query, React Hook Form, etc.), and how to add a new locale.
- **CHANGELOG.md:** Optional; list notable changes per release for users and contributors.
