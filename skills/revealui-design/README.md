# RevealUI Design System

> An internal design system extracted from the RevealUI monorepo.
> Use it to mock, prototype, or extend the RevealUI **marketing site**, **admin app**, and **docs site** with brand-correct colors, type, components, and copy.

---

## What is RevealUI?

**RevealUI** is the **agentic business runtime** by **REVEALUI STUDIO L.L.C.** (Tennessee). The product positions itself as a pre-wired stack of five primitives — **People, Content, Offers, Payments, Agents** — that an operator or engineering team can run with one command (`npx create-revealui@latest my-app`) and have agents drive under the same sign-in and plan rules.

The repo is a Turborepo with **four apps and 27 packages** (21 published on npm under `@revealui/*` plus `create-revealui`; 5 private workspace packages under Fair Source; 1 internal build-tooling package outside the OSS/Pro split). License posture is split: OSS subset under MIT, Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`) under **FSL-1.1-MIT** (Fair Source — source-visible, JWT-gated, auto-converts to MIT after 2 years).

The brand is **dark-first**, **OKLCH-based**, with a **Cobalt** brand hue at `oklch(0.36 0.190 240)` (light) / `oklch(0.58 0.150 240)` (dark, AA-compliant) and a **Solar Amber** accent at `oklch(0.80 0.165 85)`. The marketing site flips this to a **cool paper + cobalt-ink + amber-accent** palette while still consuming the same `@revealui/tokens` token set. Brand decision recorded internally (May 2026).

### Status (as of this design system, May 2026)

- Pre-launch. Zero paying customers.
- Stripe runs in **test mode** in production.
- **RevealUI Fleet** self-host runtime kit is **preview**; it is deployed via the **RevForge** stamping tool (the kit was renamed per an internal ADR — the *kit* is now "RevealUI Fleet", the *stamper* is "RevForge").
- **Ollama** is the working open-model path today; Ubuntu Inference Snaps integration is in progress.
- **Supabase** was removed in favor of NeonDB + ElectricSQL.

---

## Sources

This design system was distilled from the RevealUI monorepo. Canonical tokens are published via the `@revealui/tokens` package and its `design-context/` pack (CI drift-gated — see CLAUDE.md for how to read them).

| Source | What was extracted |
|---|---|
| `packages/tokens/src/tokens.css` (revealui repo) | Canonical OKLCH token source — read via `@revealui/tokens/design-context/` |
| Marketing site `apps/marketing/app/` | NavBar, Footer, GetStarted; landing spine: Hero (receipt motif), Problem (capability stack), Demo (`ProductFrame`), Primitives, Proof, PricingTeaser |
| Admin app `apps/admin/src/` | shadcn-style Button/Card/Input components, `scrap*` Tailwind palette |
| llms.txt | Product positioning, tier names, suite ("RevFleet") |
| GitHub repo | https://github.com/RevealUIStudio/revealui — public OSS source |
| Marketing | https://revealui.com |
| Docs | https://docs.revealui.com |
| Admin | https://admin.revealui.com |

---

## Index

```
revealui-design/  (this skill)
├── SKILL.md                        — skill entrypoint
├── README.md                       — you are here (canonical doc)
├── CLAUDE.md                       — brand orientation, open issues, voice rules
└── ui_kits/
    ├── marketing/                  — pointer only (GAP-479 retired .jsx kits)
    │   ├── README.md
    │   └── index.html              — compose @revealui/presentation in .tsx
    └── admin/                      — pointer only (GAP-479 retired .jsx kits)
        ├── README.md
        └── index.html              — compose @revealui/presentation in .tsx

Token source (not in this skill — read from the package):
  @revealui/tokens/design-context/  — committed, CI-drift-gated token pack
```

The canonical token source is the `@revealui/tokens/design-context/` pack — never a local snapshot. Do not add Babel-in-browser `.jsx` kits. Production and prototype React compose `@revealui/presentation` in TypeScript.

---

## CONTENT FUNDAMENTALS

### Voice

RevealUI sounds like a **technical co-founder writing to another technical co-founder**. Confident, blunt, lightly self-aware about being pre-launch. Writes for engineers who are tired of plumbing.

### Tone rules

- **Honest about status.** The llms.txt literally has a section titled "Status (honest, pre-launch)" that lists what's stub, what's working, and what's gated. Marketing copy never overpromises.
  > *"Stripe billing currently runs in TEST mode in production. Live mode is gated on an internal billing-readiness audit. No customer cards are charged today."*
- **Outcome-led headlines, mechanism in the subhead.** Default technical H1: "Build it once. Every product after starts ahead." Subtitle is the locked positioning form (self-hosted runtime + governed agents + any AI provider). See `copy-voice.md` + `06-copy-corpus.md`.
- **Concrete over abstract.** Numbers, timeboxes, primitive names. "Local stack in about a minute." "10,000 agent tasks / month." Metrics pinned by claim-drift CI.
- **No marketing hype.** No "revolutionize," "supercharge," "unleash." Verbs are operational: build, run, ship, deploy, wire.
- **No em dashes** in customer-facing copy (hardline).

### Pronoun + casing

- **Second person ("you")** to the reader. First person plural ("we") rare; reserved for the studio in legal/contact contexts.
- **Sentence case for headings**, including h1 and section titles. Title case appears only in nav labels and proper-noun product names.
- **Eyebrows are ALL CAPS, letter-spaced.** They open every section: `THE PROBLEM`, `WATCH IT WORK`, `WHO IT'S FOR`, `PRICING`. 12px / `0.2em` tracking / cobalt brand color or smoke-500.
- **Brand mark casing.** `RevealUI` is camel-cased prose; `REVEALUI` is reserved for the legal entity (`REVEALUI STUDIO L.L.C.`). Sub-products use `Rev`-prefix camel: `RevDev`, `RevVault`, `RevCon`, `RevSkills`, `RevKit`, `RevForge`.

### Numbers, time, status

- Numbers stay numeric (`60 seconds`, not "sixty seconds").
- Status uses **plain words in `**bold**`** in docs: `**Pro**`, `**TEST mode**`, `**preview**`. Never "Beta" with a colored pill unless inside the admin UI.
- Code names get backticks: `npx create-revealui@latest my-app`.

### Emoji + symbols

- **No emoji** in marketing or product copy. Anywhere. The whole site is emoji-free.
- Unicode marks that *do* appear: `→` (right arrow in CTA links), checkmarks in feature lists (always **SVG**, never `✓`), `&times;` for close icons. **Do not** ship em dashes in customer copy.

### Specific examples worth lifting

- **Hero H1 (technical default, locked L1):** *"Build it once. Every product after starts ahead."*
- **Hero subtitle (locked positioning):** three sentences: runtime under one roof; every agent a governed and audited user on your infrastructure; any AI provider you choose.
- **Receipt foil:** *"If an agent did it, there's a receipt."* Signature creative moment on the hero (ReceiptCard print animation).
- **Trust strip:** `Open source · Self-hostable · Local-first AI` (separators, not brand-colored dots).
- **CLI pill:** `$ npx create-revealui@latest my-app` on **GetStarted**, not competing with hero CTAs.
- **Section eyebrows:** uppercase, `0.20em` tracking, muted. Examples: `THE PROBLEM`, `WATCH IT WORK`, `PRICING`. Marketing `tracking-widest` remaps to `0.20em` in `index.css`.
- **Problem framing:** capability **stack** (not a table, not mobile matrix cards). Quiet path blurbs (Vendor sprawl / Agent framework only / RevealUI), then each capability with three aligned answers. Label column ~`11rem`.
- **Pricing teaser CTAs:** Free (`$0`, "Start free"), **Pro** (`$49/mo`, "See Pro pricing", quiet Recommended chip). Max / Enterprise are links to `/pricing`. **Do not** invert the Pro card to black.
- **Footer tagline:** agentic business runtime; People, content, offers, payments, and agents.

---

## VISUAL FOUNDATIONS

> The visual system is split across two surfaces. **Admin / docs / docs-pro** use the canonical `@revealui/tokens` token set: dark-first, OKLCH, cobalt-on-cool-slate. **Marketing** flips to a cool paper surface with `gray-950` (remapped to midnight) for headlines and the cobalt brand as the ink accent, but still imports the same tokens for components, motion, and radii. The named Tailwind palettes `emerald-*` and `gray-*` are aliased in `apps/marketing/app/index.css` so utility classes (`text-emerald-700`, `bg-emerald-50`) resolve to cobalt/smoke values — no component edits required.

- **Brand hue: Cobalt.** `oklch(0.36 0.190 240)` on light (paper) surfaces, `oklch(0.58 0.150 240)` on dark surfaces (AA-compliant — lifted in shipped code). On marketing, use `var(--rvui-brand)` for ink and primary CTAs, `var(--rvui-brand-strong)` for press / deep ink moments, `var(--rvui-brand-soft)` for ringed soft chips and code-pill backgrounds. The Tailwind `emerald-*` palette is **aliased to the Cobalt ladder** in `apps/marketing/app/index.css`, so existing utility classes (`text-emerald-700`, `bg-emerald-50`, `ring-emerald-200`) all paint Cobalt without component edits.
- **Accent: Solar Amber.** `oklch(0.80 0.165 85)` — honey-gold complement (kept away from rusty-orange). Reserved for premium tier highlights, warning state, the hero pulse-dot, and the brand-glow press shadow. **Never** becomes a primary CTA color.
- **Neutrals are cool blue-tinted slate.** Tailwind's `gray-*` ramp is **aliased to the smoke ladder** (`oklch(L 0.025-0.032 250-260)`) so existing utilities (`text-gray-950`, `bg-gray-50`, `text-gray-600`) all read as cool slate. Admin's dark surfaces are OKLCH near-midnights (`0.16 0.030 260`) — cool blue, never warm.
- **Primitive palette stays multi-hue.** People (Cobalt — the brand itself), Content (blue), Offers (amber, the accent), Payments (cyan), Agents (violet). People is the brand color (formerly "Users"; never "Intelligence" / "Products" on marketing).
- **Status colors** follow the new OKLCH ladder: success = teal-green at `L=0.55` (visually distinct from the brand blue), warning = amber `L=0.70` (the accent), error = vermillion `L=0.52`, info = the brand (info IS the brand on Cobalt).

### Typography

- **Sans:** **Inter** for everything in body and UI.
- **Display:** **Inter Tight** at 700/800 — canonical as of Cobalt v4 (Mona Sans retired with the brand migration). `--rvui-font-display` resolves directly to Inter Tight, no OFL dependency.
- **Mono:** **JetBrains Mono**, with `Fira Code` and `ui-monospace` fallbacks. Ligatures explicitly **off** in the terminal pill (`font-feature-settings: "liga" 0`).
- **Previous regression (fixed in v4):** `apps/marketing/app/index.css` had silently swapped `--font-sans` to Geist Variable and hex-overrode every shadcn bridge token. Both are gone; the marketing app now consumes `--rvui-font-*` cleanly.
- **Tracking:** Headlines run **tight** (`-0.02em`). Eyebrows run **wide** (`0.20em` letter-spacing). Body is normal.
- **Scale:** marketing is loud — h1 reaches **`text-7xl` (4.5rem)** on `lg`; section h2 sits at `text-3xl–4xl`.
- **Weight ladder:** 800 display, 700 section heading, 600 ui label, 500 small caps / mono, 400 body.

### Spacing & layout

- **4px base.** Tokens go `space-0 / 1 / 2 / 3 / 4 / 5 / 6 / 8 / 10 / 12 / 16 / 20 / 24` (px multiples of 4).
- **Page max-widths.** Marketing content boxes top out at `max-w-7xl` (80rem, 1280px). Cards-grid clamps to `max-w-5xl`. Center text blocks clamp to `max-w-2xl` or `max-w-3xl`.
- **Section rhythm.** Marketing homepage sections use `py-20 sm:py-28` (craft pass; was `py-24 sm:py-32`). Alternate paper / secondary bands. **No gradients between sections.**
- **Horizontal padding.** `px-6 lg:px-8` on every section. Mobile breathes; desktop never goes edge-to-edge.

### Marketing craft principles (2026-08)

ADR `2026-07-10-frontend-design-direction` + Linear UI redesign lessons applied to marketing:

1. **Thesis:** the calmest page in the room. Subtraction first, then one signature moment.
2. **Signature moment:** the receipt (`ReceiptCard` print animation + foil). Not multi-blob gradients, not competing CLI + multi-CTA hero stacks.
3. **Reduce visual noise:** no feature-matrix tables, no mobile "table cards," no inverted black pricing cards, no dense card grids for primitives.
4. **Alignment + density:** fixed label columns, hairline dividers, type weight for hierarchy.
5. **Limit brand chrome:** cobalt for primary CTAs and receipt integrity; surfaces stay neutral (opacities of smoke, not brand fills).
6. **Homepage max 7 sections;** hero max primary + one secondary CTA.

### Backgrounds

- **No full-bleed photography.** No hand-illustration. No repeating tile patterns.
- **Hero treatment:** one quiet top-down wash + a single low-opacity primary radial (not a 5-blob stack; not ghosted primitive icons).
- **Demo / product-as-proof:** dark outer mat (`bg-foreground` pad) around a paper admin shell. Live presentation components preferred over screenshots (stale captures are dishonest).
- **Dark blocks** on marketing: footer, receipt surface, product mat only. **Not** the Pro pricing card.

### Motion

- **Easing presets.** All animation uses RevealUI's named curves: `--rvui-ease` (cubic-bezier 0.22, 1, 0.36, 1) for default, `--rvui-ease-spring` for playful overshoots, plus in/out. **No `ease-in-out`** — the curves are always shaped.
- **Durations.** `--rvui-duration-fast` 120ms, `--rvui-duration-normal` 200ms, `--rvui-duration-slow` 350ms.
- **Hero signature motion:** ReceiptCard `animate="print"` (staggered lines + one seal pulse; `prefers-reduced-motion` static).
- **No bouncing, no scroll-jacking, no parallax.**

### Hover & press states

- **Hover (buttons):** primary darkens 10% (`bg-primary/90`) AND adds `shadow-md`. Outline variant shifts to `bg-card`. Plain links shift `text-gray-600 → text-gray-900`.
- **Hover (cards):** ring darkens from `gray-950/5 → gray-950/10`. No translate, no scale, no glow.
- **Press:** Buttons use `active:scale-[0.97]`. **That's the only transform on press.** No darkening overlays, no inner shadow.
- **Focus:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Ring color is the brand cobalt.

### Borders, rings, shadows

- **Borders are subtle.** The default surface ring is `ring-1 ring-gray-950/5` (5% opacity black). The strong variant is `ring-gray-950/10`. **You almost never see a 1px solid neutral border** on marketing — everything is a low-alpha ring.
- **Border radius scale:** `sm 6px / md 10px / lg 16px / xl 24px / full 9999px`. Marketing cards default to `rounded-2xl` (16–24px). Buttons are `rounded-md` (10px). The hero terminal pill is `rounded-xl`.
- **Shadows are layered, not deep.** `shadow-sm`, `shadow-md`, `shadow-lg`, plus a special `shadow-glow` (cobalt 25% at 20px blur) reserved for the brand-accent press states.
- **No inner shadows.** Cards use rings + outer shadows only.

### Transparency & blur

- **Sticky nav** uses `bg-white/80 backdrop-blur-md`. The only place blur appears.
- The demo section uses `backdrop-blur-[1px]` on the play-button overlay — barely perceptible, just enough to dim the screenshot underneath.
- Dark cards occasionally use `bg-black/40` for nested code blocks ringed in `ring-white/10`.

### Image vibe

- Prefer **live component frames** (`ProductFrame`: StatusDot, VerdictChip, AuditLine in admin chrome) over screenshots.
- Screenshots only when fresh and honest; never ship scaffold captures as product proof (removed from `/products` 2026-07-11 for that reason).

### Landing page structure

Technical homepage spine (`HomePage.tsx` → `TechnicalLanding`, ADR ≤7 sections):

```
Hero → Problem → Demo → Primitives → Proof → PricingTeaser → GetStarted → Footer
```

- **`Hero`:** audience toggle + locked H1/subtitle + 2 CTAs + trust strip + receipt motif.
- **`Problem`:** capability stack (aligned answers). Not a table; not mobile matrix cards.
- **`Demo`:** product mat + `ProductFrame` + three beats as divided columns.
- **`Primitives`:** stacked alternating rows (People…Agents), not a 5-card grid.
- **`Proof`:** open-source trust + live metrics (claim-drift pinned) + secondary FDE band.
- **`PricingTeaser`:** Free + Pro on paper; Max/Enterprise as links.
- **`GetStarted`:** closing CTAs + CLI pill + newsletter.

Non-technical audience (`?for=non-technical`) composes the operator services spine instead.

### Layout fixed elements

- **Sticky header** at `z-50`, height `h-16`, background + blur, bottom border.
- **Footer** is a muted band with product / community / trust columns; secondary paths (services, agency) live here, not in the hero.

---

## ICONOGRAPHY

### System

RevealUI uses **Heroicons** (24px outline, stroke-width 1.75 by default; 2 inside buttons). Icons are **inlined as JSX `<svg>` elements** at the call site — there is **no icon font, no sprite sheet, no Lucide/Heroicons npm dep visible in the codebase.** The codepoints are pasted into TSX files as `path d=...` blobs alongside their captions.

This means **for this design system, icons are reproduced inline** matching Heroicons' stroke style. CDN substitutes are NOT used; the codebase pattern is copy-the-path-into-the-component.

### The Five Primitive Icons (semantic, branded)

These five icons are the visual backbone of the marketing site. They appear in:
- the Primitives stack (ringed accent chip)
- product frame sidebar labels
- meta links where relevant

Production icons ship from `@revealui/presentation` (`IconPrimitivePeople` … `IconPrimitiveAgents`).

| Primitive | Accent |
|---|---|
| People | cobalt (brand) |
| Content | blue |
| Offers | amber |
| Payments | cyan |
| Agents | violet |

Retired labels (never reintroduce on marketing): Users, Products, Intelligence.

### Logo

> ⚠️ Verify against current brand: The pre-Cobalt logo files in the source bundle (`assets/`) use off-brand palettes (rainbow medallion, indigo text logo, orange stencil wordmark, slate favicon) and are not included in this skill. The proposed brand mark is a cobalt rounded-square (`#003E7A`) with "R" in Inter Tight 800, amber dot (`#f0b519`) at bottom-right with paper ring. Render inline for any new mockups; do not reference the off-brand asset files until they are regenerated.

### Emoji & unicode

- **Emoji: never.** Confirmed across marketing site, admin app, and docs.
- **Unicode glyphs that appear:** `→` (right arrow in link CTAs, e.g. "See full pricing →"), `&times;` for close. Checkmarks are always **inline SVG**, never `✓`. No em dashes in copy.

---

## Status & substitutions (read me)

| Item | What was used | Flag |
|---|---|---|
| Display font | **Inter Tight** | Canonical as of v4 (Cobalt). The previous Mona Sans plan was retired with the brand migration — Inter Tight is now the declared display family in `--rvui-font-display`, no fallback substitution required. |
| Icon library | inlined Heroicons paths | Codebase does not depend on `@heroicons/react`; it pastes paths inline. We follow the same pattern. |
| RevealCoin app | n/a (cancelled) | RevealCoin was cancelled 2026-05-29; the former `apps/revealcoin` surface was removed and is out-of-scope for this design system. |
| Server / API responses | not extracted | This system is visual only; backend contracts live in `@revealui/contracts`. |
