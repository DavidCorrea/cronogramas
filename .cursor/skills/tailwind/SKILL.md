---
name: tailwind
description: How this project uses Tailwind CSS v4 for styling. Use when adding or changing styles, layout, theme tokens, or responsive/design patterns.
---

# Tailwind CSS in this project

## When to use

- Adding or changing component styles, layout, or responsive behavior.
- Defining or using theme tokens (colors, radius, fonts).
- Styling new UI (buttons, cards, forms, modals).

---

## Current setup

- **Tailwind v4** with CSS-first config. No `tailwind.config.js`. Configuration is in **`src/app/globals.css`**: `@import "tailwindcss"` and `@theme inline { ... }` mapping CSS variables to Tailwind theme.
- PostCSS: **`postcss.config.mjs`** uses `@tailwindcss/postcss`.

---

## How we use theme and tokens

- **Semantic tokens** in `globals.css`: `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--destructive`, `--accent`, `--success`, `--input`, `--input-border`, plus `--font-sans`, `--font-mono`, `--radius-card`, `--radius-button`. They are mapped in `@theme inline` so utilities like `bg-background`, `text-foreground`, `border-border`, `bg-card`, `bg-primary`, `text-muted-foreground` work.
- **We use these semantic utilities** for most UI (nav, cards, buttons, inputs, borders). This is the preferred pattern.
- **Dark mode:** Class-based. `.dark` on `:root`; same tokens, different values in `:root.dark`. Fallback uses `prefers-color-scheme: dark` when no class is set. We do not use raw hex in components for theme colors.
- **Deviation:** We still use **Tailwind palette colors** in a few places for warning/success/unsaved: `text-amber-500`, `text-green-600 dark:text-green-400`, `border-amber-500/40`, `bg-amber-500/10`, `text-amber-800 dark:text-amber-200` (e.g. UnsavedBanner, holiday indicators, success messages). Best practice would be semantic tokens (e.g. `--warning`, `--success`). For **new** code prefer semantic tokens; when touching those components consider migrating to tokens.

---

## How we write classNames

- **Utility-first:** We keep styles in JSX with `className="..."`. No per-component CSS files; no `@apply` in the codebase.
- **Conditional classes:** We use **template literals** only: `` className={`base classes ${condition ? "active" : "inactive"}`} ``. When there is no "inactive" variant we use `` className={`base ${condition ? "extra" : ""}`} ``. We do **not** use a `cn()` helper or `clsx`/`tailwind-merge`; the project has no such dependency. For complex conditionals, template literals can get long; that's acceptable. If we add a helper later, the skill will be updated.
- **Long strings:** We keep long `className` strings inline. For repeated blocks (e.g. same button style in many places) we could extract a constant or a small component; we do that only when duplication is obvious.
- **Inline `style={{}}`:** We use it **only for dynamic values** that Tailwind cannot express (e.g. heights, `top`/`left` percentages, `gridRow`/`gridColumn` from JS). See `AvailabilityWeekGrid.tsx`. We do not use inline styles for static colors or spacing; use utilities instead.

---

## Reusable patterns

- **Single shared class in globals:** We have one: `.card` (plain CSS with `var(--card)`, `var(--border)`, etc.). We do **not** use `@apply` for it. For other repeated patterns we either repeat utility strings or add a similar plain-CSS class in `globals.css` using semantic variables.
- We do **not** create component-scoped CSS files for Tailwind-style rules; everything stays in JSX or in `globals.css`.

---

## Responsive and variants

- **Mobile-first:** We use `sm:`, `md:`, `lg:` for breakpoints (e.g. `md:flex`, `lg:px-8`, `hidden md:block`).
- **State variants:** We use `hover:`, `focus:`, `disabled:`, and Radix `data-[state=open]:` etc. Base transition for interactive elements is set in `globals.css` (buttons, links, inputs); we add `transition-*` in classNames when we need a specific transition.

---

## Adding or changing theme

- New semantic token: add the CSS variable in `:root` and `:root.dark` (and in the `prefers-color-scheme` block if needed), then add a line in `@theme inline` (e.g. `--color-my-name: var(--my-name);`). Use only semantic tokens in new component code when the value is theme-related.
- We do **not** add tokens in a JS config; Tailwind v4 theme lives in CSS only.

---

## Summary: do / avoid

| Do | Avoid |
|----|--------|
| Use semantic utilities (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, etc.) for theme colors | Raw hex or Tailwind palette colors for theme-related UI (prefer tokens; we still have a few amber/green usages to migrate when touching) |
| Use template literals for conditional classes | `@apply` in component CSS; we don't use it |
| Use inline `style={{}}` only for dynamic layout (height, position %, grid row) | Inline styles for static colors/spacing |
| Add new theme tokens in `globals.css` + `@theme inline` | New `tailwind.config.js` or theme in JS |
