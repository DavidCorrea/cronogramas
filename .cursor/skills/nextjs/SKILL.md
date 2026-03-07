---
name: nextjs
description: How this project uses Next.js App Router. Use when adding or changing pages, layouts, route handlers, middleware, data fetching, streaming, or routing patterns.
---

# Next.js App Router in this project

## When to use

- Adding or changing pages, layouts, or route segments.
- Writing or modifying API route handlers (`route.ts`).
- Choosing between Server and Client components.
- Fetching data (server-side vs client-side).
- Working with middleware, redirects, or dynamic routes.
- Adding loading, error, or not-found UI.

---

## Rendering model

### Server Components (default)

Every component in the `app/` directory is a Server Component unless marked with `"use client"`. Server Components can be `async`, fetch data directly, and access secrets. They send zero JavaScript to the client for the component itself.

Use Server Components for:
- Data fetching (DB queries, external APIs).
- Accessing secrets and environment variables.
- Keeping JS bundle small (static content, layouts, pages that don't need interactivity).
- SEO-critical content.

### Client Components (`"use client"`)

Add the directive when the component uses state, effects, event handlers, browser APIs, or context.

**Push the `"use client"` boundary as deep as possible.** Don't mark a whole page as client when only a button or form needs interactivity. Extract the interactive part into a separate Client Component and import it into the Server Component page.

### Interleaving Server and Client Components

Children of a Client Component can be Server Components when passed via `children` or other `ReactNode` props. The Server Component is rendered on the server and the result is slotted into the Client Component's tree.

```tsx
// layout.tsx (Server Component)
import ThemeProvider from './ThemeProvider'; // 'use client'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
  // children (pages) remain Server Components
}
```

### Context providers

Context requires `"use client"`. Create the provider as a Client Component that accepts `children`, then wrap it in a Server Component layout. This keeps everything below the provider eligible to be Server Components.

Render providers as deep in the tree as their consumers need — don't wrap the entire `<html>` if only a subtree uses that context.

### How this project does it

- **Root layout** (`src/app/layout.tsx`): Server Component. Wraps children with `NextIntlClientProvider`, `QueryProvider`, `SessionProvider`, `AppNavBar`, `KeyboardShortcuts`.
- **Config layout** (`src/app/[slug]/config/layout.tsx`): Server Component. Resolves group on the server via `getGroupForConfigLayout(slug)`, passes `initialGroup` to `ConfigLayoutClient` (Client Component shell with `GroupProvider`, `UnsavedConfigProvider`, sub-nav).
- **Most page.tsx files**: Client Components (use state, effects, TanStack Query).
- **Cronograma redirect page** (`src/app/[slug]/cronograma/page.tsx`): Server Component — just redirects to current month.

---

## Routing

### File conventions

| File | Purpose |
|------|---------|
| `page.tsx` | Makes a route publicly accessible. One per route segment. |
| `layout.tsx` | Shared UI that wraps `children`. Persists across navigations (no re-mount). Cannot access the current route segment. |
| `template.tsx` | Like layout but re-mounts on every navigation. Use when you need fresh state or animations per navigation. Not used in this project. |
| `loading.tsx` | Instant loading UI via Suspense. Automatically wraps the page in a `<Suspense>` boundary. |
| `error.tsx` | Error boundary for the route segment. Must be a Client Component. Shows fallback UI with retry/back. |
| `not-found.tsx` | UI for `notFound()` calls. Not used in this project; `notFound()` from `next/navigation` is used in server code directly. |
| `route.ts` | API route handler. Cannot coexist with `page.tsx` in the same segment. |

### Dynamic routes

- `[slug]` — single dynamic segment. Access via `params.slug`.
- `[...nextauth]` — catch-all segment. Access via `params.nextauth` (array).
- `[slug]/cronograma/[year]/[month]` — multiple dynamic segments.

In Next.js 15+, `params` is a `Promise` that must be `await`ed:

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // ...
}
```

### Route groups

Use parenthesized folder names `(groupName)` to organize routes without affecting URLs. Useful for applying different layouts to different sections. Not currently used in this project but available when needed.

### This project's route structure

```
src/app/
├── page.tsx                    # Dashboard (/)
├── login/page.tsx              # /login
├── asignaciones/page.tsx       # /asignaciones
├── settings/page.tsx           # /settings
├── groups/new/page.tsx         # /groups/new
├── admin/page.tsx              # /admin
├── [slug]/config/              # /:slug/config/*
│   ├── members/, roles/, events/, holidays/,
│   │   collaborators/, schedules/
│   └── layout.tsx              # Config layout (server-resolved group)
├── [slug]/cronograma/          # /:slug/cronograma
│   └── [year]/[month]/page.tsx # /:slug/cronograma/:year/:month
└── api/                        # Route handlers
```

---

## Layouts

### Best practices

- **Keep layouts focused.** A layout's job is shared UI (nav, sidebar, providers). Don't put page-specific data queries, conditional rendering per page, or role-based logic in layouts.
- **Layouts don't re-render on navigation** within their segment. State in a layout persists. Use `template.tsx` if you need fresh state per navigation.
- **Layouts cannot access the current route pathname.** Use `usePathname()` in a Client Component child if needed.
- **Root layout must contain `<html>` and `<body>`.** It's the only layout that requires these tags.
- **Fetch data in the component that needs it,** not in a parent layout hoping to pass it down. Layouts don't pass data to their `children` — each page fetches its own data.

### How this project does it

- **Root layout**: Providers (session, query, intl), global nav, keyboard shortcuts, theme script. No data fetching beyond session.
- **Config layout**: Resolves group by slug on the server, passes `initialGroup` to client shell. Config pages then use `useConfigContext(slug, include)` to fetch their own data.

---

## Data fetching

### Server-side (Server Components)

Fetch data directly in `async` Server Components — no API route needed. Call your data layer functions directly:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);
  return <h1>{post.title}</h1>;
}
```

**Don't fetch your own route handlers from Server Components.** This creates an unnecessary network hop. Call the underlying logic directly.

### Client-side

This project uses two patterns:
- **TanStack Query** (`useConfigContext`, `useQuery`): For config data, dashboard data. See `.cursor/skills/tanstack-react-query/SKILL.md`.
- **`fetch` in `useEffect`**: For simpler cases (home page groups, cronograma data).

For mutations from Client Components, this project uses `fetch` to route handlers rather than Server Actions (the project predates widespread Server Action adoption).

### Parallel fetching

When multiple independent data sources are needed, fetch them in parallel with `Promise.all()` to avoid waterfalls:

```tsx
const [members, roles] = await Promise.all([getMembers(groupId), getRoles(groupId)]);
```

### Request deduplication

Next.js automatically deduplicates identical `fetch` calls within a single server render. Multiple Server Components requesting the same URL trigger only one request. For non-fetch data (e.g., DB queries), use `React.cache()` to achieve the same.

---

## Route handlers (`route.ts`)

### Structure

Route handlers export named functions for HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). They use the Web `Request` and `Response` APIs.

### This project's pattern

Every route handler follows:

1. **Auth**: `requireAuth()`, `requireGroupAccess(request)`, or `requireAdmin()`.
2. **Parse input**: Query params via `request.nextUrl.searchParams`; body via `parseBody(schema, rawBody)` with Zod.
3. **Business logic**: Call model/DB functions.
4. **Response**: `NextResponse.json(data)` on success; `apiError(message, status, code?)` on failure.
5. **Dynamic params**: `params` is a `Promise` — must be awaited.

```tsx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  const { id } = await params;
  // ... auth check, business logic ...
  return NextResponse.json({ success: true });
}
```

### Caching

- `GET` route handlers are **static by default** (cached at build time). Use `export const dynamic = 'force-dynamic'` or read `request`/`headers()`/`cookies()` to make them dynamic.
- Non-GET methods (`POST`, `PUT`, `DELETE`) are always dynamic.

### When to use route handlers vs Server Actions

- **Route handlers**: Public APIs, webhook endpoints, proxy/BFF patterns, when you need explicit HTTP method control, or when clients use `fetch`.
- **Server Actions**: Internal mutations from React forms/event handlers (simpler, no manual `fetch` needed). This project primarily uses route handlers.

---

## Middleware

### Location

`src/middleware.ts` at the project root (inside `src/` due to the `src/` directory structure).

### Purpose

Runs before every matched request. Use for:
- Authentication checks and redirects.
- Public vs protected route decisions.
- Header manipulation.

### This project's middleware

- Checks for session token cookie.
- Public paths bypass auth: `/api/auth`, `/login`, `/admin`, `/:slug/cronograma/*`, `/api/cronograma/*`.
- Unauthenticated API requests → 401 JSON.
- Unauthenticated page requests → redirect to `/login`.

### Best practices

- **Keep middleware fast.** It runs on every matched request. Don't do heavy computation or DB queries.
- **Use `matcher` config** to limit which routes middleware runs on. Exclude static assets (`_next/static`, `_next/image`, `favicon.ico`).
- **Middleware runs at the edge** (or Node.js depending on deployment). Don't import heavy Node modules.

---

## Loading, error, and streaming

### `loading.tsx`

Creates an instant loading UI by automatically wrapping the page in a `<Suspense>` boundary. The loading file is shown while the page component is being rendered.

This project has loading files at:
- `/` (root) — `RootLoadingSkeleton`
- `/:slug/config` — `ConfigContentSkeleton`
- `/:slug/cronograma/:year/:month` — grid skeleton

### `error.tsx`

Must be a Client Component (`"use client"`). Receives `error` and `reset` props. The `reset` function retries rendering.

This project's error boundaries show "Reintentar" (retry) and "Volver" (go back) buttons.

### Streaming with Suspense

For granular loading states within a page, wrap slow-loading sections in `<Suspense>`:

```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <section>
      <h1>Dashboard</h1>
      <Suspense fallback={<SkeletonGrid />}>
        <SlowDataComponent />
      </Suspense>
    </section>
  );
}
```

**Place `<Suspense>` above the async component**, not inside it. The boundary catches the suspension from the `await` inside the child.

**Avoid top-level `await` in page components** when the page has other content to show. Top-level await blocks the entire page from streaming. Instead, extract the data-fetching part into a child component wrapped in Suspense.

---

## Redirects

### `redirect()`

Use `redirect()` from `next/navigation` for server-side redirects in Server Components, route handlers, or Server Actions.

**Don't use `redirect()` inside `try/catch`.** It throws internally (TypeScript `never` type). Place the redirect call after the try/catch block or in a separate code path.

```tsx
import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/cronograma/${year}/${month}`);
}
```

### How this project does it

- `/:slug/cronograma` → 302 redirect to `/:slug/cronograma/:year/:month` (current month).
- Middleware redirects unauthenticated users to `/login`.

---

## Configuration

### `next.config.ts`

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
};

export default withNextIntl(nextConfig);
```

- **`output: "standalone"`**: Self-contained build for deployment (Docker, etc.).
- **next-intl plugin**: Wraps config for i18n support.
- **Turbopack**: Enabled for dev.

### Environment variables

- `NEXT_PUBLIC_*` variables are exposed to the client bundle.
- All other `process.env.*` variables are server-only.
- Don't put secrets in `NEXT_PUBLIC_` variables.
- This project's env: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

---

## What to avoid

- **Fetching your own route handlers from Server Components.** Call the data layer directly — the route handler and Server Component both run on the server. The extra network hop is waste.
- **`"use client"` on entire pages** when only a small part needs interactivity. Extract the interactive piece into a child Client Component.
- **Fetching data in layouts to pass to pages.** Layouts don't pass data to `children`. Each page fetches its own data.
- **Heavy logic in middleware.** Middleware runs on every request. Keep it to auth checks, redirects, and header manipulation.
- **`redirect()` inside `try/catch`.** It throws internally; the catch will swallow the redirect.
- **Ignoring caching defaults.** GET route handlers are static by default. If your handler should return fresh data, opt into dynamic behavior.
- **Top-level `await` blocking streaming.** Extract slow data fetches into child components wrapped in `<Suspense>` so the page shell can stream immediately.
- **Reading `params` without awaiting.** In Next.js 15+, `params` and `searchParams` are Promises. Always `await` them.
