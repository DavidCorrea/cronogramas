---
name: react
description: How this project uses React with Next.js App Router. Use when adding or changing components, hooks, client components, list rendering, or React patterns.
---

# React in this project

## When to use

- Adding or changing React components, hooks, or client-side behavior.
- Deciding between Server and Client components.
- Rendering lists, keys, or derived state.
- Splitting, composing, or reorganizing components.
- Extracting or writing custom hooks.

---

## Server vs Client components

- **Default:** Next.js components are Server Components. No `"use client"` unless the file needs client-only APIs or behavior.
- **Use `"use client"`** when the component (or a child) uses: React state (`useState`), effects (`useEffect`), context (`useContext` or custom providers), browser APIs (`localStorage`, `document`, `window`), or event handlers that must update state (e.g. form dirty, modals, theme).
- **Keep client boundary low:** Prefer a small client wrapper that receives server-fetched data as props; avoid marking whole pages as client when only a small part needs interactivity. Example: config layout passes `initialGroup` from server; client shell provides `GroupProvider` and nav.

---

## Component architecture

### Single responsibility

Each component should have one well-defined job. If a component handles layout **and** data fetching **and** form validation **and** complex conditional rendering, those are signs it should be decomposed. A component that does one thing is easier to name, test, reuse, and understand.

### When to split a component

Don't split preemptively. Split when you experience a real problem:

- **Reusability:** You need the same UI or behavior in more than one place.
- **Testability:** The component is hard to test because it mixes concerns (data, state, UI).
- **Readability:** The file is large enough that understanding a section requires scrolling past unrelated code. A rough guideline: if a component exceeds ~200 lines, evaluate whether logic or UI sections can be extracted.
- **State isolation:** Unrelated pieces of state live together, causing confusion about which state drives which part of the UI, or unnecessary re-renders.
- **Team collaboration:** Multiple people edit the same file and cause merge conflicts.
- **Performance:** A state change re-renders a large tree when only a small part needs to update; extracting the changing part avoids re-rendering the stable parts.

When none of these problems exist, a larger component is fine. Premature extraction creates indirection (more files, more props, harder-to-follow data flow) without clear benefit. Duplication is cheaper than the wrong abstraction.

### How to split

1. **Extract UI sections** into child components that receive data via props. The parent orchestrates; children render.
2. **Extract logic** into custom hooks (see Custom hooks below). The component stays focused on rendering.
3. **Extract shared layout wrappers** (cards, sections, page shells) into reusable components that accept `children`.

---

## Composition

Composition is the primary mechanism for building complex UIs from simple pieces. Prefer composition over configuration (long prop lists) and over inheritance (never use class inheritance for components).

### Children prop

The simplest composition: pass nested JSX via `children`. Use this for layout wrappers, cards, sections, modals, and any component whose job is "render something around or alongside the caller's content."

```tsx
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-4">{children}</div>;
}
```

### Slot props (multiple composition points)

When a component needs content in multiple places (e.g., a header **and** a body **and** footer actions), use named props instead of cramming everything into `children`. This avoids prop bloat and keeps the API declarative.

```tsx
function PageSection({
  title,
  actions,
  children,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
```

### Compound components

Use when multiple sub-components need to share implicit state and work together (like `<select>` and `<option>`). The parent holds state in context; children consume it. Good for tabs, accordions, toggle groups.

### Composition to avoid prop drilling

When data passes through intermediate components that don't use it (more than 2–3 levels), restructure with composition instead of adding more props:

1. **Move the consuming component up:** Render the component that needs the data directly where the data is available, passing it as `children` through the intermediaries.
2. **Use context** when data genuinely needs to be available to many components at different depths (theme, auth, group config). Keep context values stable with `useMemo` to avoid unnecessary re-renders.

### State placement hierarchy

1. **Local state** (`useState` / `useReducer`): default; use when only one component needs it.
2. **Lifted state + props:** When a parent and a few direct children share state. Two or three levels of prop passing is normal and acceptable.
3. **Composition (children):** When intermediary components don't need the data, restructure so the consuming component is rendered directly by the data owner.
4. **Context:** When many components at different tree depths need the same data (theme, auth, group). Use sparingly; each context is a re-render boundary for all consumers.
5. **External store:** Only when context doesn't scale (very high-frequency updates, complex derived state shared across the app).

---

## Component purity

Components should behave like pure functions during render:

- **Same inputs → same output.** Given the same props, state, and context, the component always returns the same JSX.
- **No side effects in render.** Don't make API calls, modify external variables, or read from mutable globals during rendering. Side effects belong in event handlers or `useEffect`.
- **Minds its own business.** Don't mutate props, don't modify variables outside the component's scope during render.

React relies on purity to skip unnecessary re-renders, render components in any order, and discard render results safely.

---

## Writing components

### Props design

- **Minimal API surface.** Only expose props that consumers actually need. Prefer composition (children/slots) over configuration (long prop lists with flags).
- **Single props object** with a named interface or inline type. Use optional props with sensible defaults (e.g., `destructive = true`, `loading = false`).
- **Avoid boolean prop explosion.** When a component has many boolean props that toggle behavior (`isCompact`, `isCard`, `isInline`), consider using a single `variant` prop with union type instead.
- **Callback naming.** Prefix event handler props with `on` (`onClick`, `onSave`, `onClose`). Name the internal handler with `handle` (`handleClick`, `handleSave`).

### Exports

- Page components are default-exported; shared components in `src/components/` can be default or named.
- Use named exports when a file exports multiple components (e.g., `ConfirmDialog`, `DangerZone`).

### Return early for edge cases

Handle loading, error, and empty states at the top of the component with early returns. This keeps the happy-path JSX clean and unindented.

```tsx
function MemberList({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return <EmptyState message={t('members.empty')} />;
  }

  return <ul>{members.map(m => <li key={m.id}>{m.name}</li>)}</ul>;
}
```

### File organization

- **Colocation first.** Keep related code (component, types, hook, utils) close to where it's consumed.
- **Same-file subcomponents are fine** when a helper component is tightly coupled to its parent, used only there, and small. Extract to a separate file when it's reused elsewhere, is independently testable, or the file grows large.
- **Shared components** live in `src/components/`. Feature-specific components live near their feature (e.g., inside `src/app/[slug]/config/`).
- For complex shared components, a folder with an `index.ts` re-export is fine (e.g., `src/components/SharedScheduleView/`).

---

## List keys

- **Stable ID first:** When list items have a unique, stable id (e.g. from API), use it: `key={item.id}`. Do not use array index when the list can be reordered, filtered, or items added/removed.
- **Composite key when no id:** If items have no id but have a stable combination of fields (e.g. date + role + member), use a composite key: `` key={`${item.date}-${item.roleId}-${item.memberId}`} ``.
- **Index only for static, non-reordered lists:** Using `key={index}` is acceptable only when the list length and order are fixed (e.g. `Array.from({ length: 7 }).map((_, i) => ...)` for skeleton placeholders). Never use index as key for data that can be reordered or filtered.
- **No key on fragment or wrapper only:** If you map to a fragment that wraps a single child that already has a key, put the key on the outer element you render in the map (e.g. `<li key={item.id}>` not `<React.Fragment key={...}>`).

---

## Hooks

### Rules of hooks

1. Call hooks only at the **top level** of a component or custom hook — never inside loops, conditions, or nested functions.
2. Call hooks only from React functions (components or custom hooks), never from plain JavaScript functions.

Breaking these rules causes state mismatches and hard-to-track bugs. The ESLint `rules-of-hooks` plugin enforces this.

### useState

- Use for UI state that triggers re-renders (modals, form fields, filters). Keep state minimal; derive values with `useMemo` or plain variables when possible.
- For complex initial state, use lazy initializer: `useState(() => computeInitial())` to avoid running it on every render.
- **Functional updates** when new state depends on previous state to avoid stale closures: `setCount(prev => prev + 1)`.
- Group related state into an object or use `useReducer` when multiple pieces of state always change together. Don't merge unrelated state into one object just to reduce `useState` calls.

### useEffect

- **Dependencies:** Always include all reactive values used inside the effect in the dependency array. ESLint `exhaustive-deps` helps; do not disable it without a short comment explaining why (e.g. "run once on mount" with empty deps).
- **Cleanup:** If the effect subscribes to something (events, intervals, fetch abort), return a cleanup function: `return () => { document.removeEventListener(...); };`.
- **Mount-only effects:** Use `[]` only when the effect truly must run once on mount (e.g. read theme from localStorage, set up a global listener). For "run when X is available", include X in deps (e.g. `[groupId, fetchData]`).
- **Avoid syncing props/state into state.** Don't use `useEffect` to mirror props or context into state when you can derive or read them during render. The pattern `useEffect(() => setX(prop), [prop])` is almost always a mistake — just use the prop directly or compute from it.
- **Avoid using useEffect for events.** If something happens in response to a user action (click, submit, keypress), handle it in the event handler, not in an effect that watches a state change caused by that action.

### useCallback

- Use when a function is passed to a child that is memoized with `React.memo`, or when the function is in a dependency array (e.g. `useEffect(..., [fetchData])`) and must be stable to avoid unnecessary effect runs. Include all referenced props/state in the dependency array.
- Do not wrap every handler in `useCallback`; use it where referential stability matters (memoized children, effect deps). In most cases, inline handlers are fine.

### useMemo

- Use for expensive derived data (filtered/sorted lists, computed objects) that would otherwise be recomputed every render. Include all referenced inputs in the dependency array.
- Do not use `useMemo` for trivial computations; prefer plain variables when the cost is negligible.
- Use `useMemo` to keep context values and object props stable when passing them to memoized children or context consumers.

### useRef

- Use for: DOM node references (`ref={inputRef}`), mutable values that must not trigger re-renders (timeouts, "run once" flags), or storing previous values for comparison.
- Do not put refs in dependency arrays of `useEffect` when the effect should run on ref.current changes (ref updates don't re-run effects); trigger from state/props instead if needed.

---

## Custom hooks

### When to extract a custom hook

- **Shared logic:** Two or more components use the same combination of state + effects. Extract once and reuse.
- **Complexity isolation:** A component has a block of state + effects that forms a self-contained concern (e.g., form validation, keyboard shortcut, data fetching). Extracting it makes the component easier to read even if the hook is used only once.
- **Testability:** The logic is easier to test in isolation than through the component's UI.

**Don't extract** when the logic is trivial, used only once, and doesn't hurt readability. A plain function suffices when no React hooks are involved — don't make a custom hook just because the function is called from a component.

### Design guidelines

- **Name with `use` prefix** and a descriptive verb/noun: `useGroupConfig`, `useFormDirty`, `useMemberSearch`. The name should tell the caller what behavior it provides.
- **Single responsibility.** Each hook should do one thing. Prefer composing small hooks (`useDebounce` + `useFetch`) over monolithic hooks (`useEverything`).
- **Explicit return type.** Return an object with named fields when the hook returns multiple values. Arrays are fine for simple two-value returns (like `useState`), but objects are clearer for three or more values.
- **Inputs as arguments, not global reads.** Accept configuration through parameters so the hook is reusable and testable. Avoid reading from module-level variables inside the hook.
- **Keep side effects in `useEffect`.** Don't perform side effects in the hook body outside of `useEffect` or event-handler callbacks.
- **Cancellation and cleanup.** Hooks that start async work (fetches, timers, subscriptions) must clean up in the effect's cleanup function. Use `AbortController` for fetch, clear timers, and unsubscribe from listeners.

### Hooks in this project

- `useGroup()` — group context (id, slug, name, access).
- `useUnsavedConfig()` — tracks dirty state in config forms.
- `useConfigContext(slug, include)` — TanStack Query wrapper for config data.
- `useTranslations(ns)` — next-intl translations.
- See `.cursor/skills/tanstack-react-query/SKILL.md` for query/mutation hooks.
- See `.cursor/skills/react-hotkeys-hook/SKILL.md` for keyboard shortcut hooks.

---

## Performance

### When to optimize

Not all re-renders are problems. React handles frequent renders efficiently. Optimize only when you observe:

- **Visible lag or jank** in the UI.
- **Expensive computations** running on every render (large list filtering, complex calculations).
- **Unnecessary child re-renders** caused by unstable references (new object/function on every render passed as props).

### Tools

- `React.memo(Component)` — skip re-render when props haven't changed. Use for components that are expensive to render and receive the same props frequently. Don't wrap everything in `memo`; the comparison has its own cost.
- `useMemo` — memoize expensive derived values and keep object/array references stable.
- `useCallback` — keep function references stable for memoized children or effect deps.
- **State splitting:** Move frequently-changing state into a smaller child component so the parent doesn't re-render.

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
- **Error boundaries:** `error.tsx` at root, config, and cronograma levels with retry and back navigation.
- **Loading states:** Skeleton components (`src/components/Skeletons/`) and `loading.tsx` files for route-level suspense.
- **Empty states:** `EmptyState` component with message and CTA when lists have no items.

---

## What to avoid

- **Index as key** for dynamic lists (API data, reorderable items). Use stable id or composite key.
- **Missing or incorrect dependency arrays** in `useEffect`/`useCallback`/`useMemo`. Fix the deps rather than disabling the lint rule, unless there is a documented exception.
- **`"use client"` at the top of a page** when only a small section needs client behavior; push the client boundary down to a child component.
- **Storing derived data in state** when it can be computed during render (e.g. `const filtered = items.filter(...)` instead of `useEffect` that sets `setFiltered`).
- **useEffect to sync props into state.** Read the prop directly or derive from it.
- **useEffect as an event handler.** Handle user actions in the event handler itself, not by setting state and watching it in an effect.
- **Premature component splitting.** Don't extract a component before you have a real reason (reuse, testability, readability, performance). A long render function is fine when it's straightforward JSX.
- **Premature memoization.** Don't wrap every function in `useCallback` or every value in `useMemo`. Memoize when you measure or observe a problem, or when referential stability is required (memoized children, effect deps, context values).
- **Prop drilling anxiety.** Two or three levels of prop passing is normal. Reach for context or composition restructuring only when intermediaries become pure pass-throughs for many props.
- **God hooks.** A custom hook that manages five different concerns is as hard to maintain as a god component. Keep hooks focused; compose them.
