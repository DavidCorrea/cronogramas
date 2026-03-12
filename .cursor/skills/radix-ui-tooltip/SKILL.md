---
name: radix-ui-tooltip
description: >-
  How this project uses @radix-ui/react-tooltip for hover tooltips.
  Use when adding tooltips, hover hints, or note indicators in the UI.
---

# Radix UI Tooltip

## Setup

Package: `@radix-ui/react-tooltip`. Imported as `* as Tooltip`.

`Tooltip.Provider` is placed **locally** in the component that uses tooltips (not at the app root). This keeps the bundle impact scoped.

## Usage pattern

```tsx
import * as Tooltip from "@radix-ui/react-tooltip";

<Tooltip.Provider delayDuration={300}>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span>trigger element</span>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        sideOffset={6}
        className="z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md whitespace-pre-line animate-in fade-in-0 zoom-in-95"
      >
        {content}
        <Tooltip.Arrow className="fill-popover" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
```

## Conventions

- **`delayDuration={300}`** on Provider — avoids accidental triggers.
- **`Tooltip.Portal`** wraps Content so it renders outside scroll containers.
- **`Tooltip.Arrow`** included for visual anchoring; fill matches popover bg.
- **`asChild`** on Trigger to avoid extra DOM wrapper.
- **`whitespace-pre-line`** on Content when tooltip text may contain newlines.
- Styling uses the project's design tokens: `border-border`, `bg-popover`, `text-popover-foreground`, `shadow-md`.

## Current usage

| Location | Purpose |
|----------|---------|
| `src/components/SharedScheduleView/DesktopTable.tsx` | Note indicator next to date — shows event note on hover |
