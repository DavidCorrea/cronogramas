# Client / Frontend structure

## 1. Overview

The app uses **Next.js App Router**, is **mobile-first**, and all user-facing copy is in **Spanish**. The main areas are: **root layout** (global nav, session) for `/`, `/login`, `/settings`, `/admin`, and group list; **config layout** (group-scoped nav, `GroupProvider`, unsaved-changes guard) for `/[slug]/config/*`; and the **public cronograma** at `/[slug]/cronograma` (and `/[slug]/cronograma/[year]/[month]`) for viewing schedules.

## 2. Route map

### Global

| Path | Purpose | Page file |
|------|---------|-----------|
| `/` | Home: dashboard, groups list, next assignment, calendar | `src/app/page.tsx` |
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
| `/[slug]/cronograma` | Current month schedule view | `src/app/[slug]/cronograma/page.tsx` |
| `/[slug]/cronograma/[year]/[month]` | Specific month schedule view | `src/app/[slug]/cronograma/[year]/[month]/page.tsx` |

## 3. Layouts and nav

- **Root layout** — `src/app/layout.tsx`  
  Wraps the app with `SessionProvider`, global fonts, and **AppNavBar**. Renders nav + `children`; no group-specific context.

- **Config layout** — `src/app/[slug]/config/layout.tsx`  
  Wraps all `/[slug]/config/*` routes with **GroupProvider**, **UnsavedConfigProvider**, and **GroupSubNav**. Provides group `slug`/name/loading, unsaved-form state, and sub-nav (Miembros, Roles, Eventos, Vacaciones, Colaboradores, Cronogramas). Confirms before leaving when `useUnsavedConfig().dirty` on guard pages (see `config-nav-guard`).

- **AppNavBar** — `src/components/AppNavBar.tsx`  
  Top bar: logo link to `/`, theme toggle, session (avatar + settings link + sign out) or "Iniciar sesión". Hidden on `/login`. Mobile: hamburger + dropdown.

- **GroupSubNav** — Defined and used in `src/app/[slug]/config/layout.tsx`  
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
| `group-context.tsx` | `GroupProvider` / `useGroup()`: resolves group by `[slug]`, exposes `groupId`, `slug`, `groupName`, `loading`, `error`. |
| `unsaved-config-context.tsx` | `UnsavedConfigProvider` / `useUnsavedConfig()`: `dirty` / `setDirty` for config form leave guard. |
| `config-nav-guard.ts` | `isConfigFormPageWithUnsavedGuard(pathname)`: whether current path should block nav when dirty (events/roles/schedules forms). |
| `timezone-utils.ts` | Date/time display and input: `formatDateLong`, `formatDateShort`, `formatDateRangeWithYear`, `utcTimeToLocalDisplay`, `localTimeToUtc`, etc. |
| `constants.ts` | `DAY_ORDER` (Spanish weekday order), `dayIndex()` for sorting. |
| `column-order.ts` | `buildColumnOrderPayload()`: builds payload for saving role column order (used on schedules config page). |

*(Other `src/lib` modules such as `api-helpers`, `db`, `auth`, `public-schedule`, `scheduler`, `schedule-helpers`, `holiday-conflicts`, etc. are used by API routes or server code, not directly by the client UI.)*

## 6. Where to look

- **To add a new config page** — Add a route under `src/app/[slug]/config/<name>/page.tsx`. Add a link in the `navLinks` array in `src/app/[slug]/config/layout.tsx` (GroupSubNav). Use `useGroup()` for `slug`/groupId and `useUnsavedConfig()` if the page has a form that should trigger the leave guard.
- **To change the public schedule view** — Edit `src/components/SharedScheduleView.tsx`. The pages that feed it are `src/app/[slug]/cronograma/page.tsx` (current month) and `src/app/[slug]/cronograma/[year]/[month]/page.tsx` (specific month).
- **To find where X is rendered** — Search for the component name or feature text: e.g. `SharedScheduleView` → cronograma pages; `AvailabilityWeekGrid` → member new/edit; `OptionToggleGroup` → member and event forms; nav labels ("Miembros", "Roles", etc.) → `src/app/[slug]/config/layout.tsx`.
- **To change global nav or theme** — `src/components/AppNavBar.tsx` and `src/app/layout.tsx`.
- **To change group config sub-nav** — `src/app/[slug]/config/layout.tsx` (GroupSubNav and `navLinks`).
