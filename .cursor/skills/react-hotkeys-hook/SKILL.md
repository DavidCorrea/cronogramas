---
name: react-hotkeys-hook
description: Use when adding or changing keyboard shortcuts, global shortcuts (?, g+h, g+a), or config quick jump (⌘K). Covers useHotkeys usage, scoping, and preventDefault.
---

# react-hotkeys-hook in this project

## When to use

- **Global shortcuts**: Help overlay (?), go to Home (g then h), go to Mis asignaciones (g then a). Implemented in `KeyboardShortcuts`.
- **Config-scoped shortcut**: "Ir a…" quick jump (⌘K / Ctrl+K) in config layout. Implemented in `ConfigGoTo`.
- **New shortcuts**: Any new app-wide or layout-scoped keyboard shortcut should use `useHotkeys` from `react-hotkeys-hook`.

## How we use it

- **Package**: `react-hotkeys-hook` ^5.2.4. No HotkeysProvider; hooks register globally by default.
- **KeyboardShortcuts** (`src/components/KeyboardShortcuts.tsx`): Rendered in the app layout (`src/app/(app)/layout.tsx`), so not on the public cronograma. Registers:
  - `shift+/` → open help overlay (?). Options: `enableOnFormTags: false`.
  - `escape` → close help and clear g-sequence. Options: `enableOnFormTags: true` so Escape works in the overlay.
  - `g` → set pending-g state and start 1200ms timeout to clear it. Options: `enableOnFormTags: false`, `keydown: true`.
  - `h` → if pending-g, go to `/`. Options: `enableOnFormTags: false`, deps `[pendingG, router]`.
  - `a` → if pending-g, go to `/asignaciones`. Same options and deps.
- **ConfigGoTo** (`src/components/ConfigGoTo.tsx`): Rendered in config sub-nav (`ConfigLayoutInner`). Registers:
  - `mod+k` → toggle "Ir a…" modal (and clear query when opening). Options: `enableOnFormTags: false`, `preventDefault: true`.
- **Scoping**: No ref-based scoping. Global shortcuts are active whenever the component is mounted; ConfigGoTo is only mounted under `/[slug]/config/*`, so ⌘K is effectively config-scoped by tree placement.
- **Form tags**: We use `enableOnFormTags: false` for navigation shortcuts so they don’t fire when typing in inputs/textareas. Escape uses `enableOnFormTags: true` so it works when focus is inside the help overlay.

## How it should be used

- **New use cases:** Before adding a new shortcut or scope, check react-hotkeys-hook options and document the pattern here.
- **New global shortcuts**: Add to `KeyboardShortcuts.tsx`. Use `enableOnFormTags: false` for keys that would conflict with typing (letters, numbers, ?). Use `enableOnFormTags: true` only when the shortcut should also run when focus is in form fields (e.g. Escape to close).
- **New config-only shortcuts**: Add in a component that is only mounted in config layout (e.g. ConfigGoTo or a dedicated shortcuts hook in config layout). Prefer one place per "scope" to avoid duplicate handlers.
- **preventDefault**: Set `preventDefault: true` when the shortcut should override browser/default behavior (e.g. `mod+k` to avoid opening browser search). We use it for `mod+k` in ConfigGoTo.
- **Sequences**: For "g then h/a" we use local state (`pendingG`) and a timeout (1200ms). Keep the timeout ref cleanup in useEffect and in the clearSequence callback to avoid leaks and stale state.
- **Copy**: Shortcut labels and help text live in `messages/es.json` under the `shortcuts` namespace; use `useTranslations('shortcuts')` in KeyboardShortcuts.
