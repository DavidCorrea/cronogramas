---
name: react
description: How this project uses React with Next.js App Router. Use when adding or changing components, hooks, client components, list rendering, or React patterns.
---

# React in this project

## When to use

- Adding or changing React components, hooks, or client-side behavior.
- Deciding between Server and Client components.
- Rendering lists, keys, or derived state.

---

## Server vs Client components

- **Default:** Next.js components are Server Components. No `"use client"` unless the file needs client-only APIs or behavior.
- **Use `"use client"`** when the component (or a child) uses: React state (`useState`), effects (`useEffect`), context (`useContext` or custom providers), browser APIs (`localStorage`, `document`, `window`), or event handlers that must update state (e.g. form dirty, modals, theme).
- **Keep client boundary low:** Prefer a small client wrapper that receives server-fetched data as props; avoid marking whole pages as client when only a small part needs interactivity. Example: config layout passes `initialGroup` from server; client shell provides `GroupProvider` and nav.

---

## List keys

- **Stable ID first:** When list items have a unique, stable id (e.g. from API), use it: `key={item.id}`. Do not use array index when the list can be reordered, filtered, or items added/removed.
- **Composite key when no id:** If items have no id but have a stable combination of fields (e.g. date + role + member), use a composite key: `key={\`${item.date}-${item.roleId}-${item.memberId}\`}`.
- **Index only for static, non-reordered lists:** Using `key={index}` is acceptable only when the list length and order are fixed (e.g. `Array.from({ length: 7 }).map((_, i) => ...)` for skeleton placeholders). Never use index as key for data that can be reordered or filtered.
- **No key on fragment or wrapper only:** If you map to a fragment that wraps a single child that already has a key, put the key on the outer element you render in the map (e.g. `<li key={item.id}>` not `<React.Fragment key={...}>`).

---

## Hooks

### useState

- Use for UI state that triggers re-renders (modals, form fields, filters). Keep state minimal; derive values with `useMemo` when needed.
- For complex initial state, use lazy initializer: `useState(() => computeInitial())` to avoid running it on every render.

### useEffect

- **Dependencies:** Always include all reactive values used inside the effect in the dependency array. ESLint `exhaustive-deps` helps; do not disable it without a short comment explaining why (e.g. “run once on mount” with empty deps).
- **Cleanup:** If the effect subscribes to something (events, intervals, fetch abort), return a cleanup function: `return () => { document.removeEventListener(...); };`.
- **Mount-only effects:** Use `[]` only when the effect truly must run once on mount (e.g. read theme from localStorage, set up a global listener). For “run when X is available”, include X in deps (e.g. `[groupId, fetchData]`).
- **Avoid** using `useEffect` to mirror props/context into state when you can derive or read them during render; use state only when you need to update in response to user input or side effects.

### useCallback

- Use when a function is passed to a child that is memoized with `React.memo`, or when the function is in a dependency array (e.g. `useEffect(..., [fetchData])`) and must be stable to avoid unnecessary effect runs. Include all referenced props/state in the dependency array.
- Do not wrap every handler in `useCallback`; use it where referential stability matters (memoized children, effect deps).

### useMemo

- Use for expensive derived data (filtered/sorted lists, computed objects) that would otherwise be recomputed every render. Include all referenced inputs in the dependency array.
- Do not use `useMemo` for trivial computations; prefer plain variables when the cost is negligible.

### useRef

- Use for: DOM node references (`ref={inputRef}`), mutable values that must not trigger re-renders (timeouts, “run once” flags), or storing previous values for comparison. Do not put refs in dependency arrays of `useEffect` when the effect should run on ref.current changes (ref updates don’t re-run effects); trigger from state/props instead if needed.

---

## Component structure

- **Props:** Prefer a single props object with a named interface or inline type. Use optional props with sensible defaults where appropriate (e.g. `destructive = true`, `loading = false`).
- **Exports:** Page components are default-exported; shared components in `src/components/` can be default or named. Use named exports when a file exports multiple components (e.g. `ConfirmDialog`, `DangerZone`).
- **Children:** When a component accepts `children`, type them as `React.ReactNode` unless you need a more specific type.

---

## Accessibility and forms

- **Dialogs:** Use **ConfirmDialog** (Radix Dialog) for destructive confirmations; no `window.confirm()`. See `.cursor/skills/radix-ui-dialog/SKILL.md`.
- **Focus:** After opening a modal or dropdown that contains a focusable element, focus it in a `useEffect` that runs when `open` becomes true (e.g. `if (open) inputRef.current?.focus()`).
- **Click-outside:** For dropdowns/popovers, attach a document listener in `useEffect` and clean it up on unmount; use a ref to the container and check `!containerRef.current.contains(e.target)` before closing.

---

## Patterns we use

- **Context for cross-tree state:** `GroupProvider`/`useGroup()`, `UnsavedConfigProvider`/`useUnsavedConfig()`. Keep context value stable (e.g. `useMemo` for the value object) when it holds multiple fields to avoid unnecessary re-renders of consumers.
- **Data fetching:** TanStack Query in client components for config and dashboard data; see `.cursor/skills/tanstack-react-query/SKILL.md`. Server components load data on the server and pass it as props where possible (e.g. config layout).
- **Copy:** All user-facing text via next-intl; see `.cursor/skills/next-intl/SKILL.md`. No hardcoded Spanish strings in components.

---

## What to avoid

- **Index as key** for dynamic lists (API data, reorderable items). Use stable id or composite key.
- **Missing or incorrect dependency arrays** in `useEffect`/`useCallback`/`useMemo`. Fix the deps rather than disabling the lint rule, unless there is a documented exception.
- **`"use client"` at the top of a page** when only a small section needs client behavior; push the client boundary down to a child component.
- **Storing derived data in state** when it can be computed during render (e.g. `const filtered = items.filter(...)` instead of `useEffect` that sets `setFiltered`).
