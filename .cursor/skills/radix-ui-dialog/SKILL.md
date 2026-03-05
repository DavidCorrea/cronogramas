---
name: radix-ui-dialog
description: Use when working on modal dialogs, confirmations, destructive actions, or accessibility for dialogs. Covers ConfirmDialog, DangerZone, and @radix-ui/react-dialog usage.
---

# Radix UI Dialog in this project

## When to use

- **ConfirmDialog** (`src/components/ConfirmDialog.tsx`): Any yes/no or confirm/cancel flow, especially **destructive actions** (delete member, delete role, delete event, remove collaborator, delete schedule date, admin delete user, etc.). Use instead of `window.confirm()` for focus trap, aria-modal, and keyboard (Escape to close).
- **DangerZone** (`src/components/DangerZone.tsx`): Presentational wrapper for the "Zona de peligro" section at the bottom of pages where a resource can be deleted. Put the delete (or leave/remove) button inside it; pair with ConfirmDialog for the actual confirmation.
- **Dialog primitives** (`@radix-ui/react-dialog`): Use for custom modals (e.g. multi-option delete, recalc confirmation) when ConfirmDialog’s single confirm/cancel isn’t enough. Prefer ConfirmDialog when a simple confirm is sufficient.

## How we use it

- **ConfirmDialog:** Controlled pattern: `open` + `onOpenChange(open)`. Pass `title`, `message`, `onConfirm`, optional `confirmLabel`/`cancelLabel`, `destructive` (default true), `loading`. ConfirmDialog uses `Dialog.Root`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Title`, `Dialog.Description`, and `Dialog.Close asChild` for the cancel button. It sets `aria-describedby="confirm-dialog-description"`, uses `onPointerDownOutside={(e) => e.preventDefault()}` so the dialog doesn’t close on overlay click, and `onEscapeKeyDown={() => onOpenChange(false)}`.
- **DangerZone:** Renders a `<section>` with `aria-labelledby="danger-zone-title"`, optional `title`/`description` (default from `common.dangerZone` / `common.dangerZoneDescription`). No Dialog; it only groups the delete action visually and semantically.
- **Custom dialogs (EventForm):** Two inline `Dialog.Root` usages for (1) delete event with options (event only vs event and dates) and (2) recalc affected schedules. Both use `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Title`, `aria-labelledby`/`aria-describedby`, and `onEscapeKeyDown` to close.

## How it should be used (Radix best practices)

- **Controlled open state:** Use `open` and `onOpenChange` on `Dialog.Root`. Avoid conditional rendering of the whole `Dialog.Root` (e.g. `{showDialog && <Dialog.Root ...>}`); keep the Root mounted and control visibility with `open` so Radix can restore focus on close.
- **Title and description:** Always provide `Dialog.Title` (or `aria-labelledby` pointing to a title id) and `Dialog.Description` or `aria-describedby` so screen readers announce the dialog. Prefer `Dialog.Description` with an `id` for the description when using `aria-describedby` on `Dialog.Content`.
- **Focus trap and aria-modal:** Radix Dialog.Content provides focus trap and `aria-modal="true"` by default. No extra setup needed.
- **Escape and overlay:** Use `onEscapeKeyDown` to close when appropriate. For confirmations, prevent closing on overlay click with `onPointerDownOutside={(e) => e.preventDefault()}` so the user must choose an action.
- **Cancel button:** Use `Dialog.Close asChild` on the cancel button so closing is announced and focus is restored correctly.

## Findings

1. **ConfirmDialog:** Correctly uses controlled `open`/`onOpenChange`, `Dialog.Description` with id, `onPointerDownOutside` preventDefault, and `Dialog.Close asChild` for cancel. No issues.

2. **EventForm custom dialogs:** The delete and recalc dialogs are **conditionally rendered** (`{showDeleteDialog && affectedInfo && (<Dialog.Root ...>)}`). When the dialog closes, the Root unmounts, so Radix’s focus restoration may not run. **Recommendation:** Keep `Dialog.Root` mounted and use `open={showDeleteDialog}` / `open={showRecalcDialog}` with `onOpenChange`; render content inside based on state (e.g. when `affectedInfo` is null, show nothing or a loading state inside the content).

3. **EventForm description elements:** The delete and recalc dialogs use `<p id="delete-dialog-description">` and `<p id="recalc-dialog-description">` with `aria-describedby` on Content. For consistency with Radix semantics, consider using `Dialog.Description` with those ids instead of a plain `<p>`.

4. **DangerZone:** Does not use Dialog; it’s a section only. No changes needed.

5. **Other usages:** ConfirmDialog + DangerZone are used in: members/[id], roles list and roles/[id], events/EventForm, schedules list and schedules/[id], collaborators, holidays, settings, admin. All follow the same pattern (state for open, ConfirmDialog controlled, DangerZone wrapping the trigger button).
