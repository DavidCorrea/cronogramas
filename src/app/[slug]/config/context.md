# src/app/[slug]/config — Group config UI

All pages under `/[slug]/config/*` share this layout and group context.

**Layout** (`layout.tsx`): **Server component** resolves group by slug and checks access (`getGroupForConfigLayout`, **src/lib/config-server.ts**), then renders **ConfigLayoutClient** with **only** `initialGroup` (no server-side config context load). Client: **GroupProvider** (group identity only), **UnsavedConfigProvider**, **ConfigLayoutInner** (sub-nav). Config data is loaded **per-view** via **useConfigContext(slug, include)** (**src/lib/config-queries.ts**, TanStack Query); each list page requests only the slices it needs. Mutations call **refetchContext()** to invalidate config queries, then navigate. Unsaved-form state guards navigation (see **src/lib/config-nav-guard.ts**).

**List pages** (use `useConfigContext(slug, include)` with view-scoped slices; mutations call `refetchContext()` then navigate):
- **members/** — List, **members/new**, **members/[id]** (edit + availability).
- **roles/** — List, **roles/new**, **roles/[id]** (edit + “Personas con este rol”).
- **events/** — Recurring events (days); **events/new**, **events/[id]** (type, label, times, priorities). Uses **EventForm** in events folder.
- **holidays/** — Group holidays (member-scoped).
- **collaborators/** — Group collaborators.
- **schedules/** — Schedule months list; **schedules/[id]** — single month detail, notes, rebuild, audit log.

**Config landing** — `page.tsx` at `config/`: cards to members, roles, events, holidays, collaborators, schedules.

**Nav:** GroupSubNav links + “Ir a…” quick jump (⌘K) via **ConfigGoTo** (**src/components/ConfigGoTo.tsx**). Route map: **docs/CLIENT.md**.
