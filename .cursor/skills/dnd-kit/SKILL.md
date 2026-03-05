---
name: dnd-kit
description: Use when adding drag-and-drop, sortable lists, or reorder UX. Covers @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.
---

# @dnd-kit in this project

## When to use

- **Drag and drop:** Reordering items in a list (e.g. roles order, event order, schedule assignments).
- **Sortable lists:** Any list where the user can drag to reorder (e.g. "Intercambiar" or drag-to-reassign in schedule detail; see docs/IMPROVEMENT_ROADMAP.md §7 Schedule editing UX).
- **Reorder:** When the UI must reflect a new order and persist it (e.g. `displayOrder` for roles or recurring events).

## How we use it

- **Current usage:** None. The packages `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are in `package.json` but **are not imported anywhere in `src`**. No `DndContext`, `SortableContext`, `useSortable`, `useDraggable`, or `useDroppable` usage exists in the codebase.

## How it should be used (when adopted)

- **DndContext** (from `@dnd-kit/core`): Wrap the draggable area; provide `onDragEnd` (and optionally `sensors`, `collisionDetection`) to handle reorder and persist new order (e.g. PATCH displayOrder).
- **SortableContext** (from `@dnd-kit/sortable`): Wrap a list of sortable items; use the same `items` array (e.g. ids) for `items` prop so sortable logic can compute order.
- **useSortable** (from `@dnd-kit/sortable`): In each sortable item component; use `attributes`, `listeners`, `setNodeRef`, `transform`, `transition` to attach drag handle and apply move animation.
- **Utilities:** `@dnd-kit/utilities` provides `CSS.Transform` for applying transform from sensor data. Use when building custom drag overlays or transforms.
- **Accessibility:** dnd-kit supports keyboard and screen readers when sensors and modifiers are configured; prefer `PointerSensor` + `KeyboardSensor` with sensible delays.

## Findings

1. **Unused dependency:** Per docs/IMPROVEMENT_ROADMAP.md §1, the three packages are not used in `src`. Either **remove** them to reduce bundle size or **use** them for the planned schedule drag-and-drop / "Intercambiar" UX (see §7).

2. **Where it could be used:** Schedule detail page (reorder or swap assignments), config role list (reorder roles), config events/days (reorder events). No implementation exists yet.

3. **If removing:** Run `npm uninstall @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` and update AGENTS.md if the stack section mentions dnd-kit.

4. **If adding:** Follow dnd-kit docs for DndContext + SortableContext + useSortable; keep a single source of truth for order (e.g. server `displayOrder`) and sync after `onDragEnd`.
