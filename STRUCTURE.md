# Structure

A map of how the codebase is organized.

## Top-level

| Path | Purpose |
|------|---------|
| `src/` | Application source code |
| `spec/` | Jest tests (mirrors model layer; `npm test`) |
| `scripts/` | Utility scripts (`seed.ts` — realistic seed data) |
| `docs/` | Living documentation: `API.md` (route index), `CLIENT.md` (page map), `DATABASE.md` (schema reference) |
| `messages/` | i18n strings (`es.json` — single Spanish locale, used via next-intl) |
| `.cursor/rules/` | Cursor AI rules (`.mdc` files, some symlinked from `../code-rules/`) |
| `.cursor/skills/` | Library usage skills (one folder per library with `SKILL.md`) |

## Source (`src/`)

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router — pages, layouts, route handlers |
| `src/components/` | Shared React components (AppNavBar, ConfirmDialog, DangerZone, EmptyState, Skeletons, SharedScheduleView, etc.) |
| `src/db/` | Database: `schema.ts` (Drizzle ORM), `migrations/` (drizzle-kit generated) |
| `src/lib/` | Domain logic, helpers, and shared utilities |
| `src/i18n/` | next-intl configuration |

## Pages (`src/app/`)

Pages are split into two route groups (folder names in parentheses don't appear in URLs):

- **`(app)/`** — everything signed-in users navigate. Its `layout.tsx` reads the session and renders the global nav and keyboard shortcuts.
- **`(public)/`** — the guest-facing cronograma. It has no session or app nav, so it can be served from the CDN cache. The root `layout.tsx` wraps both groups, so it must never read the session or cookies.

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — cross-group assignments and conflicts |
| `/login` | Google OAuth sign-in |
| `/settings` | User settings and user-level holidays |
| `/asignaciones` | "Mis asignaciones" — user's assignments across groups with filters and calendar export |
| `/groups/new` | Create a new group |
| `/admin` | Admin panel — manage users and groups |
| `[slug]/config/` | Group configuration (members, roles, events, holidays, collaborators, schedules) |
| `[slug]/cronograma/[year]/[month]` | Public schedule view (Server Component with ISR) |

## API (`src/app/api/`)

Route index and auth details in `docs/API.md`.

| Prefix | Purpose |
|--------|---------|
| `/api/auth/` | Auth.js (NextAuth) + Google Calendar OAuth callback |
| `/api/admin/` | Admin operations (users, groups, impersonation, bootstrap auth) |
| `/api/configuration/` | Group config CRUD (roles, events, holidays, priorities, exclusive groups, context) |
| `/api/members/` | Member CRUD |
| `/api/groups/` | Group CRUD and collaborators |
| `/api/schedules/` | Schedule CRUD, notes, rehearsals |
| `/api/cronograma/` | Public schedule data (by slug) |
| `/api/user/` | Dashboard, assignments, calendar export |
| `/api/holidays/` | User-level holidays |
| `/api/users/search` | User search (group-scoped) |

## Domain logic (`src/lib/`)

| File | Purpose |
|------|---------|
| `schedule-model.ts` | Schedule generation orchestrator (pure, no DB) |
| `scheduler.ts` | Low-level round-robin scheduling engine |
| `scheduler-types.ts` | Shared types for the scheduler |
| `dashboard-conflicts.ts` | Time-aware cross-group conflict detection |
| `auth.ts` | Auth.js config, session helpers, impersonation |
| `config-server.ts` | Server-side group resolution (`getGroupForConfigLayout`) |
| `load-config-context.ts` | Config context loader (view-scoped slices) |
| `data-access.ts` | Server-only data access functions (shared between pages and API routes) |
| `public-schedule.ts` | Public schedule builder and ISR revalidation |
| `schemas/` | Zod schemas for request validation |
| `api-helpers.ts` | Error helpers, group access, request parsing |
| `rate-limit.ts` | In-memory rate limiter by IP |

## Tests (`spec/`)

Jest with ts-jest. Model code must have exhaustive tests.

| Test file | Covers |
|-----------|--------|
| `schedule-model.spec.ts` | `schedule-model.ts` (40 scenarios) |
| `scheduler.spec.ts` | `scheduler.ts` |
| `dashboard-conflicts.spec.ts` | `dashboard-conflicts.ts` |
| `schedule-date-creation.spec.ts` | Schedule date creation logic |
| `recurring-event-schedule-impact.spec.ts` | Event changes affecting schedules |
| `column-order.spec.ts` | Column ordering |
| `config-nav-guard.spec.ts` | Config navigation guards |
| `app-nav-bar.spec.tsx` | AppNavBar component |

## Naming conventions

- Pages: `page.tsx` (Next.js convention), client-interactive parts in `*Client.tsx`
- Components: PascalCase files, one component per file
- Lib modules: kebab-case files
- Schemas: `src/lib/schemas/<resource>.ts`
- Tests: `spec/<module>.spec.ts` or `.spec.tsx`
