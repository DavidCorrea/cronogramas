---
name: typescript
description: How this project uses TypeScript for type safety and maintainability. Use when adding or changing types, interfaces, API contracts, or tsconfig.
---

# TypeScript in this project

## When to use

- Adding or changing types, interfaces, or type aliases.
- Writing or refactoring functions, API handlers, or React components.
- Adjusting compiler options or path aliases.

---

## Current setup

- **Strict mode:** `"strict": true` in `tsconfig.json`. We do not disable it; we fix type errors properly.
- **Path alias:** `@/*` maps to `./src/*`. We use `@/components/...`, `@/lib/...`, `@/app/...` for imports from `src`.
- **No `any`:** The codebase has no `any` types and no `as any` or `@ts-ignore`/`@ts-expect-error`. We keep it that way. Use `unknown` for truly dynamic values and narrow with type guards or Zod before use.

---

## How we type objects and props

- **Interfaces** for object shapes: component props (e.g. `ConfirmDialogProps`), API request/response shapes, context data, options objects. We use `export interface Name { ... }` for public contracts.
- **Types** for: unions (`"draft" | "committed"`), inferred shapes (`z.infer<typeof schema>`), and inline object types (e.g. `export type UserAssignment = { ... }`). We use `type` when we need a union, intersection, or mapped type, or when the shape is derived (Zod, `ComponentProps<>`).
- So: **interface** = object shape we define; **type** = union, inference, or one-off object type. Both are used; the choice matches the above.

---

## Non-null assertion (`!`)

- We use `!` in **a few places only**:
  - After **`Map.get(key)`** when we have just ensured that key exists in the same block (e.g. we `.set()` then `.get()` and push). Example: `weekMap.get(weekNum)!.push(sd)`.
  - After a **guard** when the value is used in a callback or branch where the compiler doesn't narrow (e.g. `member!.id` inside a handler when we've already checked `if (member)`).
- **Prefer** optional chaining (`?.`), nullish coalescing (`??`), or an explicit check instead of `!`. Add `!` only when the type system cannot narrow and we have guaranteed the value. Do not use `!` to silence errors; fix the type or the logic.

---

## Functions and APIs

- **Exports and route handlers:** We use explicit parameter types; return types are often inferred. For public API (exported functions, route handlers) explicit return types are preferred for clarity.
- **React components:** We use plain function components with a **props interface** (e.g. `ConfirmDialogProps`). We do not use `React.FC`; we type props and optionally return type as `JSX.Element` when it helps. We use `React.ComponentProps<typeof X>` when we need to type something by an existing component's props.
- **Async:** We use `async/await` and return `Promise<T>` (or let it be inferred). API routes return `NextResponse` and handle errors; we avoid uncaught rejections.

---

## Schema and validation

- **Zod** is used for request validation and for inferred types. We export both: `export const mySchema = z.object({...});` and `export type MyType = z.infer<typeof mySchema>`. Handlers use `parseBody(schema, body)` or `schema.parse(...)`; types stay in sync with the schema. We do not duplicate shape definitions.

---

## Next.js and React

- **Route handlers:** We use `NextRequest` and `NextResponse`. Params and searchParams are typed as needed (Next.js 13+ types).
- **Event handlers:** We use `(e) => ...` without explicit event types unless we need properties of the event. When we do, we use `React.MouseEvent<HTMLButtonElement>` etc.
- **Refs:** We use `useRef<HTMLInputElement>(null)` and access `.current` with optional chaining when the ref might not be set.

---

## Summary: do / avoid

| Do | Avoid |
|----|--------|
| Use `interface` for object shapes (props, API bodies), `type` for unions and `z.infer<>` | `any`; use `unknown` and narrow instead |
| Use `!` only after Map.get when key was just set, or after a guard the compiler can't see | `!` to silence errors; fix the type or logic |
| Use path alias `@/` for `src/` imports | Relative imports that go up through many levels |
| Keep strict mode on and fix type errors | `@ts-ignore` or disabling strict |
