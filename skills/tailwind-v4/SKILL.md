---
name: tailwind-v4
description: Tailwind CSS v4 patterns, CSS-first configuration, and v3 migration guide. Use when writing styles, configuring @theme variables, creating components with CVA, migrating from tailwind.config.js, or using container queries, dark mode, and new v4 utility syntax. Covers @import tailwindcss, custom properties, oklch colors, and clsx.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Tailwind CSS v4 Patterns

## CSS-First Configuration (No tailwind.config.js)

Tailwind v4 uses CSS instead of JavaScript for configuration:

```css
/* app.css */
@import "tailwindcss";

@theme {
  --color-brand: #3b82f6;
  --color-brand-dark: #1d4ed8;
  --font-heading: "Inter", sans-serif;
  --breakpoint-3xl: 1920px;
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

- No `tailwind.config.js` or `tailwind.config.ts` needed
- `@theme` block defines design tokens as CSS custom properties
- All theme values become utilities automatically: `bg-brand`, `font-heading`, etc.

## Theme Variables

```css
@theme {
  /* Colors */
  --color-primary: oklch(0.7 0.15 250);
  --color-surface: #ffffff;
  --color-surface-dark: #1a1a2e;

  /* Spacing */
  --spacing-gutter: 1.5rem;

  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --text-display: 3.5rem;
  --leading-display: 1.1;

  /* Shadows */
  --shadow-card: 0 1px 3px oklch(0 0 0 / 0.12);

  /* Radius */
  --radius-card: 0.75rem;

  /* Animations */
  --animate-slide-in: slide-in 0.3s var(--ease-spring);
}
```

## Using Theme Variables in Components

```tsx
// Theme variables are available as utilities
<div className="bg-primary text-surface rounded-card shadow-card">
  <h1 className="font-sans text-display leading-display">Title</h1>
</div>
```

```css
/* Or use CSS custom properties directly */
.custom-element {
  background: var(--color-primary);
  border-radius: var(--radius-card);
}
```

## Dark Mode

```css
@theme {
  --color-surface: #ffffff;
  --color-text: #1a1a2e;
}

/* Override in dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #1a1a2e;
    --color-text: #e5e5e5;
  }
}
```

Or use the `dark:` variant:

```tsx
<div className="bg-surface dark:bg-surface-dark text-text dark:text-text-light">
```

## New v4 Syntax

```tsx
// Container queries (built-in)
<div className="@container">
  <div className="@lg:grid-cols-3">Content</div>
</div>

// Arbitrary theme values
<div className="bg-(--color-brand/50)">50% opacity brand</div>

// Nested groups
<div className="group/card">
  <div className="group-hover/card:opacity-100">Shows on card hover</div>
</div>

// has() variant
<div className="has-[input:checked]:bg-blue-500">
```

## Migration from v3

Key changes:
1. Move `tailwind.config.js` colors/fonts/etc. into `@theme` CSS block
2. Remove `tailwind.config.js` (or keep minimal for plugins)
3. Replace `@tailwind base/components/utilities` with `@import "tailwindcss"`
4. Update color opacity syntax: `bg-blue-500/50` stays the same
5. Custom properties: `theme()` function replaced by `var(--color-*)` in CSS

## Component Patterns (CVA)

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      intent: {
        primary: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-surface border border-gray-300 hover:bg-gray-50',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = VariantProps<typeof button> & React.ButtonHTMLAttributes<HTMLButtonElement>;
```

## Common Mistakes to Avoid

1. Don't create a `tailwind.config.js` in v4 — use `@theme` in CSS
2. Don't use `@apply` excessively — prefer utility classes directly
3. Don't hardcode colors — define in `@theme` for consistency
4. Don't use arbitrary values when a theme token exists
5. Don't forget to set up `clsx` or `cn()` for conditional class merging
6. Don't list broad prefix aliases before specific subpath aliases in Vite config

---

*Skill by [RevealUI Studio](https://revealui.com) — the agentic business runtime.*
