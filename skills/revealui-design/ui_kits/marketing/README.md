# Marketing UI Kit — revealui.com

Recreation of the public marketing site (`apps/marketing`). Light surface, cool paper + cobalt-ink + amber-accent palette, Tailwind CDN + Inter / Inter Tight / JetBrains Mono.

The `emerald-*` and `gray-*` Tailwind names are **aliased to cobalt/smoke** in production `apps/marketing/app/index.css`. For canonical token values read `@revealui/tokens/design-context/`.

## Craft bar (2026-08)

Aligned to ADR `2026-07-10-frontend-design-direction` + Linear redesign lessons used on the homepage craft pass:

| Rule | Do |
|---|---|
| Calmest page in the room | Subtraction first; one signature creative moment (the **receipt**) |
| Reduce visual noise | No spreadsheet tables, no matrix cards, no inverted black Pro cards |
| Alignment + density | Fixed label columns (`~11rem`), type hierarchy over rings |
| Limit brand chrome | Cobalt for primary CTAs and receipts; neutrals everywhere else |
| Product-as-proof | Live component frame / dark product mat; never stale screenshots |

## Components

| File | Maps to source |
|---|---|
| `NavBar.jsx` | `app/components/NavBar.tsx` |
| `Hero.jsx` | `app/components/landing/Hero.tsx` (+ receipt motif) |
| `Problem.jsx` | `app/components/landing/Problem.tsx` (capability stack) |
| `Demo.jsx` | `app/components/landing/Demo.tsx` + `ProductFrame.tsx` |
| `Primitives.jsx` | `app/components/landing/Primitives.tsx` |
| `Pricing.jsx` | `app/components/landing/PricingTeaser.tsx` |
| `Faq.jsx` | FAQ patterns (secondary surfaces; not on default homepage spine) |
| `Footer.jsx` | `app/components/Footer.tsx` |

## Homepage spine (production)

```
Hero → Problem → Demo → Primitives → Proof → PricingTeaser → GetStarted → Footer
```

Maximum **7 sections** (ADR hard rule). Hero carries primary + one secondary CTA only.

## Conventions

- Default surface edge: low-alpha ring or hairline divider — **not** heavy card chrome.
- Eyebrows: 11–12px, `tracking-[0.20em]`, uppercase, muted or brand (not both shouting).
- Display headlines: Inter Tight, tracking-tight, sentence case.
- Primitives vocabulary (locked): **People, Content, Offers, Payments, Agents**.
- Receipt foil: `If an agent did it, there's a receipt.` (no em dashes in copy).
- CLI pill: `$ npx create-revealui@latest my-app` lives on **GetStarted**, not the hero.
- Pricing highlight: quiet "Recommended" chip + paper card; **not** inverted `bg-gray-950`.

Open `index.html` to see sections composed into a homepage.
