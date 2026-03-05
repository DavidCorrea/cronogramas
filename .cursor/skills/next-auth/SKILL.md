---
name: next-auth
description: Use when working on auth, session, login, Auth.js v5, or @auth/drizzle-adapter in this project.
---

# Next-Auth (Auth.js v5) in this project

## How we use it

- **Config**: Single source in `src/lib/auth.ts`. We use `NextAuth()` with:
  - **Adapter**: `@auth/drizzle-adapter` with `users` and `accounts` tables only (no `sessions` table).
  - **Session**: `strategy: "jwt"` — session data lives in an encrypted JWT cookie; adapter persists users/accounts for OAuth.
  - **Provider**: Google OAuth. Custom sign-in page: `pages.signIn: "/login"`.
  - **Events**: `createUser` — auto-links members by email when a new user signs in.
  - **Callbacks**: `jwt` — stores `id` and fetches `isAdmin` / `canCreateGroups` from DB on sign-in or `trigger === "update"`. `session` — maps token to `session.user` (id, isAdmin, canCreateGroups).
- **Exports**: `handlers`, `auth`, `signIn`, `signOut` (used by API route and server/client callers).
- **API route**: `src/app/api/auth/[...nextauth]/route.ts` re-exports `GET`/`POST` from `handlers`.
- **Server session**: We use `auth()` from `@/lib/auth` (Auth.js v5 API), not `getServerSession`. Used in `src/lib/api-helpers.ts` (`requireAuth`, `requireGroupAccess`, `requireAdmin`) and `src/lib/config-server.ts` (`getGroupForConfigLayout`).
- **Client**: Root layout wraps app in `SessionProvider` (`src/components/SessionProvider.tsx`). Components use `useSession`, `signIn`, `signOut` from `next-auth/react` (e.g. `AppNavBar`, `login/page.tsx`).
- **Middleware**: `src/middleware.ts` allows public paths (auth API, login, admin, cronograma); for other routes it checks for cookie `authjs.session-token` or `__Secure-authjs.session-token` and returns 401 for API or redirects to `/login` for pages.

## How it should be used (best practices)

- **Session strategy**: JWT is appropriate when you don’t need instant server-side revocation; adapter is still used for user/account persistence (OAuth). Use database sessions only if you need “sign out everywhere” or strict revocation.
- **Secret**: Set `AUTH_SECRET` (or `NEXTAUTH_SECRET`) with high entropy (e.g. `npm exec auth secret`). Required in production.
- **Route protection**: Prefer server-side checks: `requireAuth()` / `requireGroupAccess(request)` in API handlers and `auth()` + redirect in server components. Middleware is a fast gate; always enforce in the handler/layout.
- **Session data**: Keep JWT payload small; extend via `jwt`/`session` callbacks. For fresh server-only data (e.g. admin flags), fetch in callbacks or in the route (we fetch isAdmin/canCreateGroups in jwt callback and in requireAdmin from DB).
- **Type augmentation**: Custom `User` and `Session` are declared in `src/lib/auth.ts`; use these types across the app.
- **Secure cookies**: In production (HTTPS), Auth.js uses `__Secure-`-prefixed cookies; middleware already checks both names for dev/prod.

## Findings

| Area | Status | Note |
|------|--------|------|
| `auth()` vs `getServerSession` | Correct | We use `auth()` everywhere; v5 pattern. |
| JWT + adapter (users/accounts only) | Correct | No sessions table; adapter for OAuth persistence only. |
| Middleware cookie names | Correct | `authjs.session-token` and `__Secure-authjs.session-token` cover dev and prod. |
| Env var name | Prefer update | Docs recommend `AUTH_SECRET`; we document `NEXTAUTH_SECRET` in AGENTS.md — both work; consider documenting `AUTH_SECRET` as primary. |
| requireAdmin DB re-check | Good | We re-verify `isAdmin` from DB in `requireAdmin`, not only from session. |

## Reference

- **Project**: `reference.md` in this folder — exports, session shape, where `requireAuth`/`requireGroupAccess` are used (see also **docs/API.md**).
- **Auth.js**: [Session strategies](https://authjs.dev/concepts/session-strategies), [Drizzle adapter](https://authjs.dev/reference/drizzle-adapter), [Environment variables](https://authjs.dev/guides/environment-variables).
