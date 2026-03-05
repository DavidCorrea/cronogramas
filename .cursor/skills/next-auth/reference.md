# Next-Auth (Auth.js v5) — Project reference

## auth.ts exports (`src/lib/auth.ts`)

- **handlers** — `GET` / `POST` for the catch-all route; used in `src/app/api/auth/[...nextauth]/route.ts`.
- **auth** — Server-side session getter. Returns `Session | null`. Use in API handlers and server components.
- **signIn** / **signOut** — Used from client via `next-auth/react` (re-exported by NextAuth; we use the client package in components).

## Session shape (augmented in auth.ts)

```ts
Session.user: {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin: boolean;
  canCreateGroups: boolean;
}
```

`id`, `isAdmin`, and `canCreateGroups` are set in callbacks; `isAdmin` is re-verified from DB in `requireAdmin()`.

## Where requireAuth / requireGroupAccess are used

- **requireAuth()** — Used by: groups (list/create), members [id], collaborators, schedules [id], schedule notes, user dashboard, user assignments/google-calendar, users/search, holidays. Returns `{ user }` or `{ error: NextResponse }`.
- **requireGroupAccess(request)** — Used by: configuration (context, days, roles, priorities, exclusive-groups, holidays), members (list/create), schedules (list/create). Accepts `?groupId=N` or `?slug=xxx`. Returns `{ user, groupId }` or `{ error }`.
- **requireAdmin(request)** — Used by: admin users (GET/PUT/DELETE), admin groups (GET/PATCH). Session `isAdmin` or bootstrap (Basic Auth / cookie when no admin users).

Full route index and auth semantics: **docs/API.md** (§2 Route index, §3 Per-domain summary, §4 Where to look).

## Auth route

- **GET, POST** `/api/auth/[...nextauth]` — Auth.js catch-all (sign-in, callback, session). File: `src/app/api/auth/[...nextauth]/route.ts`.
