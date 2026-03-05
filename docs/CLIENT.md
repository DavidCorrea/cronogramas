# Client / Frontend structure

## 1. Overview

The app uses **Next.js App Router**, is **mobile-first**, and all user-facing copy is in **Spanish**. The main areas are: **root layout** (global nav, session) for `/`, `/login`, `/settings`, `/admin`, and group list; **config layout** (group-scoped nav, `GroupProvider`, unsaved-changes guard) for `/[slug]/config/*`; and the **public cronograma** at `/[slug]/cronograma` (and `/[slug]/cronograma/[year]/[month]`) for viewing schedules.

**Copy / wordings:** All client-facing text lives in **`messages/es.json`** (next-intl). In client components use `useTranslations('namespace')` and then `t('key')` or `t('key', { n: value })` for placeholders. Namespaces match the top-level keys in the messages file (e.g. `nav`, `home`, `members`, `configNav`, `common`, `cronograma`).

## 2. Route map

### Global

| Path | Purpose | Page file |
|------|---------|-----------|
| `/` | Home: dashboard, groups list, next assignment, calendar | `src/app/page.tsx` |
| `/asignaciones` | My assignments: list and filters (group, month, role) | `src/app/asignaciones/page.tsx` |
| `/login` | Google sign-in | `src/app/login/page.tsx` |
| `/settings` | User profile, personal holidays, link to admin | `src/app/settings/page.tsx` |
| `/admin` | Admin panel: users, flags (isAdmin, canCreateGroups) | `src/app/admin/page.tsx` |
| `/admin/login` | Bootstrap admin login (when no admins exist) | `src/app/admin/login/page.tsx` |

### Groups

| Path | Purpose | Page file |
|------|---------|-----------|
| `/groups/new` | Create new group | `src/app/groups/new/page.tsx` |
| `/[slug]/config` | Group config landing: cards to members, roles, events, etc. | `src/app/[slug]/config/page.tsx` |

### Group config

| Path | Purpose | Page file |
|------|---------|-----------|
| `/[slug]/config/members` | List members | `src/app/[slug]/config/members/page.tsx` |
| `/[slug]/config/members/new` | Add member + availability | `src/app/[slug]/config/members/new/page.tsx` |
| `/[slug]/config/members/[id]` | Edit member + availability | `src/app/[slug]/config/members/[id]/page.tsx` |
| `/[slug]/config/roles` | List roles | `src/app/[slug]/config/roles/page.tsx` |
| `/[slug]/config/roles/new` | Create role | `src/app/[slug]/config/roles/new/page.tsx` |
| `/[slug]/config/roles/[id]` | Edit role | `src/app/[slug]/config/roles/[id]/page.tsx` |
| `/[slug]/config/events` | List events (days) | `src/app/[slug]/config/events/page.tsx` |
| `/[slug]/config/events/new` | Create event | `src/app/[slug]/config/events/new/page.tsx` |
| `/[slug]/config/events/[id]` | Edit event | `src/app/[slug]/config/events/[id]/page.tsx` |
| `/[slug]/config/holidays` | Group holidays | `src/app/[slug]/config/holidays/page.tsx` |
| `/[slug]/config/collaborators` | Group collaborators | `src/app/[slug]/config/collaborators/page.tsx` |
| `/[slug]/config/schedules` | List/generate schedules | `src/app/[slug]/config/schedules/page.tsx` |
| `/[slug]/config/schedules/[id]` | Single schedule detail/notes | `src/app/[slug]/config/schedules/[id]/page.tsx` |

### Public cronograma

| Path | Purpose | Page file |
|------|---------|-----------|
| `/[slug]/cronograma` | Redirects (302) to `/[slug]/cronograma/[year]/[month]` for current month | `src/app/[slug]/cronograma/page.tsx` |
| `/[slug]/cronograma/[year]/[month]` | Schedule view for that month; "Guardar en calendario" adds events to Google Calendar | `src/app/[slug]/cronograma/[year]/[month]/page.tsx` |

**Loading UI:** `src/app/loading.tsx` (dashboard/generic skeleton), `src/app/[slug]/config/loading.tsx` (config list skeleton), `src/app/[slug]/cronograma/[year]/[month]/loading.tsx` (cronograma grid skeleton) show route-level skeletons during navigation.

**Error boundaries:** `src/app/error.tsx` (root), `src/app/[slug]/config/error.tsx`, `src/app/[slug]/cronograma/error.tsx` catch runtime/fetch errors and show a message with "Reintentar" and "Volver".

## 3. Layouts and nav

- **Root layout** — `src/app/layout.tsx`  
  Wraps the app with `SessionProvider`, global fonts, and **AppNavBar**. Renders nav + `children`; no group-specific context.

- **Config layout** — `src/app/[slug]/config/layout.tsx`  
  **Server component**: resolves group by slug and checks access once (`getGroupForConfigLayout`), then passes **only** `initialGroup` to the client (no server-side config context load). **Client shell** (`ConfigLayoutClient.tsx`): **GroupProvider** (group identity only), **UnsavedConfigProvider**, **ConfigLayoutInner** (sub-nav), **UnsavedBanner** (visible when dirty + beforeunload), then main. Config **list pages** load their data via **view-scoped** `useConfigContext(slug, include)` from `src/lib/config-queries.ts` (TanStack Query); each list page requests only the slices it needs. **ConfigGoTo** requests `['members','roles','days','schedules']`. After mutations, call `refetchContext()` from `useGroup()` to invalidate config queries so active views refetch. **Route-level loading:** `src/app/[slug]/config/loading.tsx` shows a skeleton (sub-nav + list cards) during navigation.

- **AppNavBar** — `src/components/AppNavBar.tsx`  
  Top bar: logo link to `/`, links to Inicio and Mis asignaciones (when signed in), theme toggle, session (avatar + settings link + sign out) or "Iniciar sesión". Hidden on `/login`. Mobile: hamburger + dropdown with same links. Theme: inline script in root layout sets first-paint theme from `prefers-color-scheme` or stored preference; `src/lib/theme.ts` provides the store used by the toggle.
- **KeyboardShortcuts** — `src/components/KeyboardShortcuts.tsx`  
  Global: `?` opens help overlay with shortcuts (g then h = Inicio, g then a = Mis asignaciones). Rendered in root layout.
- **ConfigGoTo** — `src/components/ConfigGoTo.tsx`  
  In config layout: "Ir a…" button and **⌘K** shortcut open a search that finds members, roles, events, or schedule months by name and navigates.

- **GroupSubNav** — Defined in `src/app/[slug]/config/ConfigLayoutInner.tsx`, used inside config layout  
  Second bar under AppNavBar: group name link to `/[slug]/config`, then links to members, roles, events, holidays, collaborators, schedules. Desktop horizontal links; mobile collapsible menu. Uses `useGroup()` and `useUnsavedConfig()` for guard on navigation.

## 4. Key components

| Component | Path | Purpose |
|-----------|------|---------|
| SharedScheduleView | `src/components/SharedScheduleView.tsx` | Renders the public cronograma: month grid, entries, notes, navigation; used by both cronograma pages. |
| AvailabilityWeekGrid | `src/components/AvailabilityWeekGrid.tsx` | Week grid to set member availability (blocks per day); used in member new/edit. |
| EventForm | `src/app/[slug]/config/events/EventForm.tsx` | Form for create/edit event: day, type, label, times, priorities; integrates unsaved-config. |
| OptionToggleGroup | `src/components/OptionToggleGroup.tsx` | Reusable bordered toggle group for multi-select (e.g. active days, roles, available days). |
| AppNavBar | `src/components/AppNavBar.tsx` | Global top nav (logo, theme, auth). |
| SessionProvider | `src/components/SessionProvider.tsx` | NextAuth session provider wrapper. |

## 5. Shared lib (UI-related)

Client-facing modules under `src/lib` used for data or behavior:

| Module | Purpose |
|--------|---------|
| `group-context.tsx` | `GroupProvider` / `useGroup()`: receives `initialGroup` from config server layout (group identity only). Exposes `groupId`, `slug`, `groupName`, `loading`, `error`, and `refetchContext()` (invalidates TanStack Query config cache for this slug). Config data is **not** in context; use `useConfigContext(slug, include)` from `config-queries.ts` for view-scoped data. |
| `config-queries.ts` | **TanStack Query**: `useConfigContext(slug, include?)` loads config via `GET /api/configuration/context?slug=…&include=…`. Pass `include` (e.g. `['members']`, `['roles','exclusiveGroups','members']`) to fetch only the slices that view needs. `configContextQueryKey(slug, include)` for cache keys / invalidation. |
| `unsaved-config-context.tsx` | `UnsavedConfigProvider` / `useUnsavedConfig()`: `dirty` / `setDirty` for config form leave guard. |
| `config-nav-guard.ts` | `isConfigFormPageWithUnsavedGuard(pathname)`: whether current path should block nav when dirty (events/roles/schedules forms). |
| `timezone-utils.ts` | Date/time display and input: `formatDateLong`, `formatDateShort`, `formatDateRangeWithYear`, `utcTimeToLocalDisplay`, `localTimeToUtc`, etc. |
| `constants.ts` | `DAY_ORDER` (Spanish weekday order), `dayIndex()` for sorting. |
| `column-order.ts` | `buildColumnOrderPayload()`: builds payload for saving role column order (used on schedules config page). |

*(Other `src/lib` modules such as `api-helpers`, `db`, `auth`, `public-schedule`, `scheduler`, `schedule-helpers`, `holiday-conflicts`, etc. are used by API routes or server code, not directly by the client UI.)*

## 6. Where to look

- **To add a new config page** — Add a route under `src/app/[slug]/config/<name>/page.tsx`. Add a link in the `navLinks` array in `src/app/[slug]/config/ConfigLayoutInner.tsx` (GroupSubNav). Use `useGroup()` for `slug`/groupId and `useConfigContext(slug, include)` for list data (pass only the slices that page needs). Use `useUnsavedConfig()` if the page has a form that should trigger the leave guard.
- **To change the public schedule view** — Edit `src/components/SharedScheduleView.tsx`. The pages that feed it are `src/app/[slug]/cronograma/page.tsx` (current month) and `src/app/[slug]/cronograma/[year]/[month]/page.tsx` (specific month).
- **To find where X is rendered** — Search for the component name or feature text: e.g. `SharedScheduleView` → cronograma pages; `AvailabilityWeekGrid` → member new/edit; `OptionToggleGroup` → member and event forms; nav labels ("Miembros", "Roles", etc.) → `src/app/[slug]/config/layout.tsx`.
- **To change global nav or theme** — `src/components/AppNavBar.tsx` and `src/app/layout.tsx`. Keyboard shortcuts overlay: `src/components/KeyboardShortcuts.tsx`.
- **To change group config sub-nav** — `src/app/[slug]/config/ConfigLayoutInner.tsx` (GroupSubNav and `navLinks`).
- **To change any client-facing wording** — Edit **`messages/es.json`**. In components use **next-intl**: `useTranslations('namespace')` and `t('key')` (or `t('key', { n: value })` for placeholders).
