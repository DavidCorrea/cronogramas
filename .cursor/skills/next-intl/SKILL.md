---
name: next-intl
description: Use when working on i18n, translations, next-intl, messages, Spanish locale, or client-facing copy in this Next.js app.
---

# next-intl in this project

## How we use it

- **Locale:** Single locale `es`. No locale segment in the URL; middleware does not use next-intl (auth only).
- **Config:** `src/i18n/request.ts` — `getRequestConfig` returns `locale: "es"` and messages from `messages/es.json`. Plugin wired in `next.config.ts` via `createNextIntlPlugin("./src/i18n/request.ts")`.
- **Root layout:** `src/app/layout.tsx` wraps the app in `NextIntlClientProvider`. Messages are loaded and passed as the `messages` prop (see Findings).
- **Client copy:** All user-facing text lives in `messages/es.json`. Top-level keys are namespaces (e.g. `nav`, `home`, `members`, `configNav`, `common`, `cronograma`, `schedules`, `roles`, `events`, `holidays`, `scheduleDetail`, `myAssignments`, `admin`, `login`, `settings`, `errorBoundary`, `newGroup`, `collaborators`, `shortcuts`).
- **In components:** Use `useTranslations('namespace')` then `t('key')` or `t('key', { n: value })` for placeholders. Multiple namespaces per component are fine (e.g. `useTranslations("roles")`, `useTranslations("common")`).
- **Raw/arrays:** For unprocessed values (e.g. month name arrays), `t.raw('key')` is supported. The codebase sometimes casts `useTranslations(...) as unknown as { raw: (k: string) => string[] }`; the real return type can be string or array depending on the message.
- **Error handling:** `IntlErrorHandlingProvider` exists (`src/components/IntlErrorHandlingProvider.tsx`) but is not used in the root layout (comment: nesting breaks SSG of `/_not-found`). Root layout has no custom `onError` or `getMessageFallback`.

## How it should be used

- **New copy:** Add keys to `messages/es.json` under the right namespace (or add a new top-level key). In components use `useTranslations('namespace')` and `t('key')`; for placeholders use `t('key', { name: value })` (or `n` for numbers where plural rules apply).
- **Server Components:** Async Server Components can use `getTranslations`, `getLocale`, `getMessages` from `next-intl/server` instead of hooks. This project currently uses only client/shared components with `useTranslations`.
- **Root layout:** Prefer loading messages via `getMessages()` from `next-intl/server` (single source of truth with `getRequestConfig`), with a fallback when `getMessages()` is undefined (e.g. `_not-found`).
- **Plurals:** Use next-intl plural rules and `t('key', { n: count })` with ICU plural forms in messages (e.g. "one" / "other") where applicable.
- **Tests:** Mock `next-intl`: `jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))` (see `spec/app-nav-bar.spec.tsx`).

## Findings

1. **Message source in root layout:** Layout loads messages with `(await import("../../messages/es.json")).default` instead of `getMessages()` from `next-intl/server`. The project already uses `getRequestConfig` in `src/i18n/request.ts`. For a single source of truth, root layout should use `getMessages()` with a fallback when undefined (e.g. for `_not-found`). See docs/IMPROVEMENT_ROADMAP.md §1.

2. **No next-intl in middleware:** Middleware (`src/middleware.ts`) only handles auth and public paths; it does not set locale or use next-intl. That is intentional (single locale, no i18n routing).

3. **`.raw()` usage:** Several places (e.g. `ConfigGoTo.tsx`, `page.tsx` home, schedules pages) use `(useTranslations("...") as unknown as { raw: (k: string) => string[] }).raw("months")` to get string arrays. next-intl does provide `t.raw('key')`; the cast is to satisfy TypeScript for array return types. Prefer typing the namespace or using a small helper instead of repeating the cast.

4. **IntlErrorHandlingProvider unused:** Optional client-side `onError`/`getMessageFallback` are not in the root tree to avoid SSG issues on `/_not-found`. Add in a route-level layout if you need custom error handling for a section.

5. **No `getLocale` / `getTranslations` in app code:** Only `useTranslations` and (in layout comment) `getMessages` are referenced. For async Server Components, use `getTranslations('namespace')` and `getLocale()` from `next-intl/server`.
