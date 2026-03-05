# src/lib — Shared utilities and logic

Shared code used by API routes, pages, and components. No route handlers or page components here.

| File / folder | Purpose |
|---------------|---------|
| **api-helpers.ts** | `requireAuth`, `requireGroupAccess`, `requireAdmin`, `extractGroupIdOrSlug`, `apiError`, `parseBody`. |
| **auth.ts** | Auth.js config, callbacks, adapter. |
| **db.ts** | Drizzle client. |
| **group-context.tsx** | GroupProvider, useGroup; fetches config context (BFF). |
| **config-queries.ts** | TanStack Query: `useConfigContext(slug, include)`, `configContextQueryKey`, `configContextQueryKeyPrefix`. |
| **load-config-context.ts** | Server: `loadConfigContextForGroup(groupId, { include })`; used by config context API and server layout when needed. |
| **config-server.ts** | `getGroupForConfigLayout(slug)` for config layout server resolution. |
| **group.ts** | `resolveGroupBySlug`, group helpers. |
| **scheduler.ts** + **scheduler.types.ts** | Schedule generation: round-robin, event time window, exclusive groups, event_role_priorities. |
| **schedule-helpers.ts** | Schedule/date assignment helpers. |
| **public-schedule.ts** | Public cronograma data (by slug, year, month). |
| **schemas/** | Zod schemas for API validation (roles, exclusive-groups, holidays, schedule-notes, groups, members). Use `parseBody(schema, body)` in handlers. |
| **rate-limit.ts** | In-memory rate limit for public cronograma GET. |
| **timezone-utils.ts** | UTC/local conversion for schedule times. |
| **unsaved-config-context.tsx** | UnsavedConfigProvider for config forms. |
| **config-nav-guard.ts** | Guard logic when leaving config with unsaved changes. |
| **affected-schedule-dates.ts** | Dates affected by recurring-event change. |
| **audit-log.ts** | Schedule audit log writes. |
| **holiday-conflicts.ts** | Holiday conflict detection. |
| **dates.ts**, **column-order.ts**, **constants.ts** | Misc helpers. |

Schema and migrations live in **src/db/**; see **db/CONTEXT.md**.
