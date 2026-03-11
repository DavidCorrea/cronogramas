---
name: radix-ui-dialog
description: Use when working on modal dialogs, confirmations, destructive actions, or accessibility for dialogs. Covers ConfirmDialog, DangerZone, and @radix-ui/react-dialog usage.
---

# Radix UI Dialog in this project

## When to use

- **ConfirmDialog** (`src/components/ConfirmDialog.tsx`): Any yes/no or confirm/cancel flow, especially **destructive actions** (delete member, delete role, delete event, remove collaborator, delete schedule date, admin delete user, etc.). Use instead of `window.confirm()` for focus trap, aria-modal, and keyboard (Escape to close).
- **DangerZone** (`src/components/DangerZone.tsx`): Presentational wrapper for the "Zona de peligro" section at the bottom of pages where a resource can be deleted. Put the delete (or leave/remove) button inside it; pair with ConfirmDialog for the actual confirmation.
- **Dialog primitives** (`@radix-ui/react-dialog`): Use for custom modals (e.g. multi-option delete, recalc confirmation) when ConfirmDialog's single confirm/cancel isn't enough. Prefer ConfirmDialog when a simple confirm is sufficient.

## Unified dialog pattern

All dialogs follow a consistent three-section layout:

1. **Header** (`px-6 py-4 border-b border-border`): display font (`font-[family-name:var(--font-display)]`), `font-semibold text-lg uppercase` title via `Dialog.Title`, optional `Dialog.Description` below (`text-sm text-muted-foreground mt-1`), and a ✕ close button right-aligned.
2. **Body** (`px-6 py-4`): form fields, informational content, or action options.
3. **Footer** (`px-6 py-4 border-t border-border` or integrated into body): action buttons right-aligned, primary button uses `bg-primary` / `bg-destructive`, cancel uses `border border-border`.

Shared classes on every dialog:
- **Overlay:** `fixed inset-0 z-50 bg-black/50` (no animations).
- **Content:** `fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background shadow-lg focus:outline-none`.
- **Behavior:** `onPointerDownOutside={(e) => e.preventDefault()}` (forces intentional close), `onEscapeKeyDown` to close.

## How we use it

- **ConfirmDialog** (`src/components/ConfirmDialog.tsx`): Controlled via `open` + `onOpenChange`. Props: `title`, `message`, `onConfirm`, optional `confirmLabel`/`cancelLabel`, `destructive` (default true), `loading`. Header shows title + message + ✕. Footer has cancel (`Dialog.Close asChild`) + confirm button.
- **DangerZone** (`src/components/DangerZone.tsx`): Presentational wrapper for the "Zona de peligro" section. No Dialog; it only groups the delete action visually and semantically. Pair with ConfirmDialog.
- **DateFormModal** (`src/app/[slug]/config/schedules/[id]/DateFormModal.tsx`): Form dialog for adding/editing schedule dates. Three-section layout with form fields in body.
- **RebuildModal** (`src/app/[slug]/config/schedules/[id]/RebuildModal.tsx`): Controlled via `open` prop. Mode selection → preview → apply. Three-section layout with scrollable body.
- **DateDetailModal** (`src/components/SharedScheduleView/DateDetailModal.tsx`): Informational read-only dialog. Header with date, body with roles/members table.
- **KeyboardShortcuts** (`src/components/KeyboardShortcuts.tsx`): Internal state (`showHelp`). Header + shortcuts list in body.
- **DashboardClient calendar detail** (`src/app/DashboardClient.tsx`): Inline Radix Dialog. Shows assignments and conflicts for a selected calendar date.
- **EventForm dialogs** (`src/app/[slug]/config/events/EventForm.tsx`): Two inline dialogs — (1) delete with multi-option actions, (2) recalc confirmation. Both use the three-section layout.

## How it should be used (Radix best practices)

- **New dialogs must follow the unified pattern** above (three sections, display font uppercase title, ✕ close, same Content/Overlay classes). Use DateFormModal as the reference implementation.
- **Controlled open state:** Use `open` and `onOpenChange` on `Dialog.Root`. Keep the Root always mounted; control visibility with `open` so Radix restores focus on close.
- **Title and description:** Always provide `Dialog.Title` and `Dialog.Description` (or `aria-describedby`). Use `sr-only` class on Description when there's no visible subtitle.
- **Focus trap and aria-modal:** Radix Dialog.Content provides these by default. No extra setup needed.
- **Escape and overlay:** Always wire `onEscapeKeyDown` to close. Always prevent overlay click with `onPointerDownOutside={(e) => e.preventDefault()}`.
- **Cancel button:** Use `Dialog.Close asChild` on cancel/close buttons for proper focus restoration.
