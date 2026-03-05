# src/app/api/configuration — Group config API

All routes here are **group-scoped**; use `requireGroupAccess(request)` and pass `?groupId=N` or `?slug=xxx`. See **docs/API.md** for the full route table.

| Segment | Purpose |
|---------|---------|
| **context/** | BFF: single GET returns group, members, roles, days (recurring events), exclusiveGroups, schedules. Used by config layout and list pages. |
| **days/** | Recurring events (weekday, type, label, times). GET list, POST/PUT/DELETE; `[id]/affected-schedule-dates`, `[id]/recalculate-assignments`. |
| **roles/** | Roles CRUD + PATCH for display order. |
| **priorities/** | Event–role priorities (fill order per assignable event). |
| **exclusive-groups/** | Exclusive role groups; DELETE by `[id]`. |
| **holidays/** | Member holidays for the group; DELETE at `holidays/[id]`. |

Config UI under **src/app/[slug]/config/** consumes these; it uses the context BFF and calls `refetchContext()` after mutations before navigating.
