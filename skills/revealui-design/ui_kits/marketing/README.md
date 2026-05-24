# Marketing UI Kit — revealui.com

Recreation of the public marketing site (`apps/marketing`). Light surface, cool paper + cobalt-ink + amber-accent palette, Tailwind utilities + Inter/Inter Tight/JetBrains Mono.

The `emerald-*` and `gray-*` Tailwind names are **aliased to cobalt/smoke** in `apps/marketing/app/index.css` — utility classes like `text-emerald-700` and `bg-emerald-50` render as cobalt; the alias is accurate, not a brand reference. For canonical token values read from `@revealui/presentation/design-context/`.

## Components

| File | Maps to source |
|---|---|
| `NavBar.jsx` | `app/components/NavBar.tsx` |
| `Hero.jsx` | `app/components/landing/Hero.tsx` |
| `Primitives.jsx` | `app/components/landing/Primitives.tsx` |
| `Pricing.jsx` | composite of `PricingTeaser.tsx` + `PricingPage.tsx` |
| `Faq.jsx` | `app/components/landing/Faq.tsx` |
| `Footer.jsx` | `app/components/Footer.tsx` |

## Conventions

- `ring-1 ring-gray-950/5` is the default card border — never hard borders on light surface.
- Hero terminal pill (`npx create-revealui@latest my-app`) is the brand signature; reuse verbatim.
- Pricing highlight tier is `bg-gray-950` with cobalt accents (rendered via the `emerald-400` Tailwind alias — accurate alias, cobalt hue).
- Eyebrows are 12-13px, `tracking-[0.2em]`, uppercase, cobalt brand color OR gray-500 (rendered via the `emerald-700` Tailwind alias).
- Display headlines use `font-display` (Inter Tight) and `tracking-tight` (-0.02em).

Open `index.html` to see all sections composed into a homepage.
