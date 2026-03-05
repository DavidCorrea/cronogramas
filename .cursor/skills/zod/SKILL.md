---
name: zod
description: How this project uses Zod for validation, request body parsing, and shared types. Use when adding or changing API request validation, schemas in src/lib/schemas, parseBody, or error handling for invalid payloads.
---

# Zod in this project

## How we use it

- **Schemas live in** `src/lib/schemas/`: one file per domain (roles, members, groups, holidays, exclusive-groups, schedule-notes). Re-exported from `src/lib/schemas/index.ts`.
- **API body parsing**: Use **`parseBody(schema, body)`** from `src/lib/api-helpers.ts`. It runs `schema.safeParse(body)` and returns either `{ data }` or `{ error: NextResponse }` with status 400 and code `VALIDATION`, using the first Zod issue message. Never use `.parse()` in route handlers—it throws; use `parseBody` (which uses safeParse) so errors are returned as responses.
- **Types**: Prefer **`z.infer<typeof schema>`** for request/response types so they stay in sync with the schema. Export when needed (e.g. `ConfigHolidayCreate` in holidays schema).
- **Stack**: Zod v4. Dependencies: `zod` in package.json.

## How it should be used

1. **New or updated request bodies**: Add or edit a schema in `src/lib/schemas/<domain>.ts`, export from `index.ts`, and use `parseBody(schema, await request.json())` in the route. If validation fails, return `parsed.error` (already a NextResponse).
2. **Error shape**: All API errors use `{ error: string, code?: string }`. Validation errors from `parseBody` use `apiError(message, 400, "VALIDATION")`. Use **`apiError`** for other 4xx/5xx in the same routes so the shape is consistent.
3. **safeParse vs parse**: Use **safeParse** (via `parseBody`) in API routes. Use `.parse()` only in non-request code where throwing is acceptable (e.g. tests or internal transforms).
4. **Messages**: Put user-facing messages in the schema (e.g. `.min(1, "El nombre es obligatorio")`). Keep messages in Spanish where the UI is Spanish; use a single locale per schema file.
5. **Transforms**: Use `.transform()` for trimming and normalization (e.g. `.transform((s) => s.trim())`). Required fields and format checks (regex, refine) should run before transforms where it matters.

## Where parseBody is used

- `src/app/api/configuration/roles/route.ts` — POST: `roleCreateSchema`; PUT: `roleUpdateSchema`; PATCH: `roleReorderSchema`
- `src/app/api/configuration/exclusive-groups/route.ts` — POST: `exclusiveGroupCreateSchema`
- `src/app/api/configuration/holidays/route.ts` — POST: `configHolidayCreateSchema`
- `src/app/api/schedules/[id]/notes/route.ts` — POST: `scheduleNoteSchema`

Other routes (e.g. members POST/PUT, groups POST) still use manual checks; when touching those, prefer migrating to the corresponding schema and `parseBody` for consistency.

## Findings (audit)

- **parseBody** correctly uses safeParse and returns the first issue message; error responses include `code: "VALIDATION"`.
- **Roles PUT/PATCH** were updated to use `parseBody` with `roleUpdateSchema` and `roleReorderSchema`, and to use `apiError` for all 400/404 responses so error shape matches the rest of the API.
- **Members and groups** have schemas (`memberCreateSchema`, `memberUpdateSchema`, `groupCreateSchema`) but their routes do not use them yet; refactor to `parseBody` when changing those handlers.
- **Exported inferred types**: Only holidays exports `ConfigHolidayCreate`; other schemas can export `z.infer<typeof schema>` when a type is needed elsewhere.
