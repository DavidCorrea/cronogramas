# docs — High-level documentation

Central docs for API, client, and database. Keep them in sync when you change routes, pages, or schema.

| File | Purpose |
|------|---------|
| **API.md** | API route index: method, path, purpose, handler file. Auth (requireAuth / requireGroupAccess / public). Error shape, validation, DELETE conventions. Update when adding or changing API routes. |
| **CLIENT.md** | Route map (pages by path), layouts, key components, nav. Update when adding pages or changing nav. |
| **DATABASE.md** | Tables and relations, migration workflow, where to look. Update when changing schema. |

**AGENTS.md** at project root is the single source for product behaviour, scripts, migrations, and agent rules; it references these docs for "where to look."
