# src/components — Shared UI components

Reusable React components used across the app. All user-facing text should use **next-intl** (`useTranslations`, `t(...)`) and keys from **messages/es.json**.

| Component | Purpose |
|-----------|---------|
| **AppNavBar** | Global top nav: logo, Inicio, Mis asignaciones, theme toggle, session (avatar/settings/sign out). Used in root layout. |
| **GroupSubNav** | Rendered inside config layout: group name, links to members, roles, events, holidays, collaborators, schedules; “Ir a…” trigger. |
| **ConfigGoTo** | Quick jump modal: search members, roles, events, schedule months by name; ⌘K shortcut. Used in config layout. |
| **SharedScheduleView** | Public cronograma: month grid, entries, notes, nav. Used by cronograma pages. |
| **AvailabilityWeekGrid** | Weekday grid for member availability (blocks per day). Used in member new/edit. |
| **BackLink** | Top-of-page back link (to list). Uses `common.back`, `members.backToMembers`, etc. |
| **OptionToggleGroup** | Bordered multi-select toggle (e.g. active days, roles, available days). |
| **KeyboardShortcuts** | Global shortcuts; `?` opens help overlay. Rendered in root layout. |
| **LoadingScreen** | Loading state. |
| **SessionProvider** | Auth session provider wrapper. |

Route map and which pages use which components: **docs/CLIENT.md**.
