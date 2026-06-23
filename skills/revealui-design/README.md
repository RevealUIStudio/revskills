# RevealUI Design System

> An internal design system extracted from the RevealUI monorepo.
> Use it to mock, prototype, or extend the RevealUI **marketing site**, **admin app**, and **docs site** with brand-correct colors, type, components, and copy.

---

## What is RevealUI?

**RevealUI** is the **agentic business runtime** by **REVEALUI STUDIO L.L.C.** (Tennessee). The product positions itself as a pre-wired stack of five primitives — **Users, Content, Products, Payments, AI** — that an indie founder or AI product team can run with one command (`npx create-revealui@latest my-app`) and have agents drive via MCP.

The repo is a Turborepo with **five apps and 26 packages** (21 published on npm under `@revealui/*` plus `create-revealui`; 5 private workspace packages). License posture is split: OSS subset under MIT, Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`) under **FSL-1.1-MIT** (Fair Source — source-visible, JWT-gated, auto-converts to MIT after 2 years).

The brand is **dark-first**, **OKLCH-based**, with a **Cobalt** brand hue at `oklch(0.36 0.190 240)` (light) / `oklch(0.58 0.150 240)` (dark, AA-compliant) and a **Solar Amber** accent at `oklch(0.80 0.165 85)`. The marketing site flips this to a **cool paper + cobalt-ink + amber-accent** palette while still consuming the same `@revealui/tokens` token set. Brand decision recorded internally (May 2026).

### Status (as of this design system, May 2026)

- Pre-launch. Zero paying customers.
- Stripe runs in **test mode** in production.
- **RevealUI Fleet** self-host runtime kit is **preview**; it is deployed via the **RevForge** stamping tool (the kit was renamed per an internal ADR — the *kit* is now "RevealUI Fleet", the *stamper* is "RevForge").
- **Ollama** is the working open-model path today; Ubuntu Inference Snaps integration is in progress.
- RevealCoin (RVC) on Solana mainnet; trading gated on multi-sig + vesting.
- **Supabase** is being phased out in favor of NeonDB + ElectricSQL.

---

## Sources

This design system was distilled from the RevealUI monorepo. Canonical tokens are published via the `@revealui/tokens` package and its `design-context/` pack (CI drift-gated — see CLAUDE.md for how to read them).

| Source | What was extracted |
|---|---|
| `packages/tokens/src/tokens.css` (revealui repo) | Canonical OKLCH token source — read via `@revealui/tokens/design-context/` |
| Marketing site `apps/marketing/app/` | NavBar, Footer, GetStarted, ContactForm, NewsletterSignup, ProductMockup; landing sections: Hero, Problem, Demo, Primitives, WhatsShipped, Persona, Proof, PricingTeaser, Faq |
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
    ├── marketing/                  — cobalt light marketing site (self-contained)
    │   ├── README.md
    │   ├── index.html                open directly in browser — no external deps
    │   ├── NavBar.jsx
    │   ├── Hero.jsx
    │   ├── Primitives.jsx
    │   ├── Pricing.jsx
    │   ├── Faq.jsx
    │   └── Footer.jsx
    └── admin/                      — cobalt dark Studio dashboard (self-contained)
        ├── README.md
        ├── index.html                open directly in browser — no external deps
        ├── Sidebar.jsx
        ├── Topbar.jsx
        └── Dashboard.jsx

Token source (not in this skill — read from the package):
  @revealui/tokens/design-context/  — committed, CI-drift-gated token pack
```

The canonical token source is the `@revealui/tokens/design-context/` pack — never a local snapshot. The ui_kits inline a minimal cobalt token subset for standalone browser use; production code should read from the pack.

---

## CONTENT FUNDAMENTALS

### Voice

RevealUI sounds like a **technical co-founder writing to another technical co-founder**. Confident, blunt, lightly self-aware about being pre-launch. Writes for engineers who are tired of plumbing.

### Tone rules

- **Honest about status.** The llms.txt literally has a section titled "Status (honest, pre-launch)" that lists what's stub, what's working, and what's gated. Marketing copy never overpromises.
  > *"Stripe billing currently runs in TEST mode in production. Live mode is gated on an internal billing-readiness audit. No customer cards are charged today."*
- **Outcome-led headlines, mechanism in the subhead.** Hero h1 is "Build a business your agents can run." Subhead names what's actually shipped: "Auth, billing, content, and AI primitives wired into one runtime."
- **Concrete over abstract.** Numbers, timeboxes, primitive names. "Local stack in 60 seconds." "10,000 agent tasks / month." "5 primitives, 5 apps, 22 packages."
- **No marketing hype.** No "revolutionize," "supercharge," "unleash." Verbs are operational: build, run, ship, deploy, wire.

### Pronoun + casing

- **Second person ("you")** to the reader. First person plural ("we") rare; reserved for the studio in legal/contact contexts.
- **Sentence case for headings**, including h1 and section titles. Title case appears only in nav labels and proper-noun product names.
- **Eyebrows are ALL CAPS, letter-spaced.** They open every section: `THE PROBLEM`, `WATCH IT WORK`, `WHO IT'S FOR`, `PRICING`. 12px / `0.2em` tracking / cobalt brand color or smoke-500.
- **Brand mark casing.** `RevealUI` is camel-cased prose; `REVEALUI` is reserved for the legal entity (`REVEALUI STUDIO L.L.C.`). Sub-products use `Rev`-prefix camel: `RevDev`, `RevVault`, `RevCon`, `RevSkills`, `RevKit`, `RevForge`, `RevealCoin`.

### Numbers, time, status

- Numbers stay numeric (`60 seconds`, not "sixty seconds").
- Status uses **plain words in `**bold**`** in docs: `**Pro**`, `**TEST mode**`, `**preview**`. Never "Beta" with a colored pill unless inside the admin UI.
- Code names get backticks: `npx create-revealui@latest my-app`.

### Emoji + symbols

- **No emoji** in marketing or product copy. Anywhere. The whole site is emoji-free.
- Unicode marks that *do* appear: `→` (right arrow in CTA links), `&mdash;` (em-dash in subheads), `✓` (checkmarks in feature lists, always rendered as `<svg>`, not the unicode glyph), `&times;` (close icons, also drawn as SVG).

### Specific examples worth lifting

- **Hero eyebrow (Cobalt pulse-dot in amber for accent):** `Open-source. Self-hostable. Audit-grade.`
- **Hero headline (single line):** *"The open runtime for AI-native businesses."*
- **Hero subhead lead:** *"Yours to install. Ours to build for you."* — bridges DIY (`npx create-revealui`) and done-for-you (RevealUI Studio agency).
- **Hero terminal pill:** `$ npx create-revealui@latest my-app` — brand `npx`, paper-white package name, amber argument, muted `$` prompt. (Cobalt + amber palette.)
- **Section eyebrows:** `THE PROBLEM`, `THE STACK SO FAR`, `CAPABILITIES, FILE BY FILE`, `WATCH IT WORK`, `FIVE PRIMITIVES. ONE AUDIT LOG. ONE POLICY PLANE.`, `WHO IT'S FOR`, `TRUST`, `PRICING`. 12px, `0.20em` tracking, brand color on light surface / `--rvui-text-2` on muted bands. Marketing app's `tracking-widest` Tailwind utility is remapped to `0.20em` via the index.css palette override.
- **Comparison framing (Problem section):** a 3-column table — `Vendor sprawl` vs `Agent framework only` vs `RevealUI` — across Auth, CMS, Stripe, MCP, audit log, cost. Six rows. The old binary `"Six months of plumbing"` framing has been retired.
- **Pricing tiers and CTAs:** Free (`$0`, "Get started free"), **Pro** (`$49/mo`, "See Pro pricing" — marked `Most popular`), Max (`$149/mo`, surfaced via "See full pricing"), Enterprise (`$299/mo`, "Talk to us"). Pro includes **10,000 agent tasks / month**.
- **Footer mission statement:** unchanged — "Agentic business runtime. Users, content, products, payments, and AI, pre-wired, open source, and ready to deploy."
- **Persona italic pull-quote** (governance-flavored, the new ICP): *"You have a working agent demo. Now your first procurement review wants audit trails, identity gates, and a story for who can revoke an agent at 3am — without rebuilding the runtime to get there."*

---

## VISUAL FOUNDATIONS

> The visual system is split across two surfaces. **Admin / docs / docs-pro** use the canonical `@revealui/tokens` token set: dark-first, OKLCH, cobalt-on-cool-slate. **Marketing** flips to a cool paper surface with `gray-950` (remapped to midnight) for headlines and the cobalt brand as the ink accent, but still imports the same tokens for components, motion, and radii. The named Tailwind palettes `emerald-*` and `gray-*` are aliased in `apps/marketing/app/index.css` so utility classes (`text-emerald-700`, `bg-emerald-50`) resolve to cobalt/smoke values — no component edits required.

- **Brand hue: Cobalt.** `oklch(0.36 0.190 240)` on light (paper) surfaces, `oklch(0.58 0.150 240)` on dark surfaces (AA-compliant — lifted in shipped code). On marketing, use `var(--rvui-brand)` for ink and primary CTAs, `var(--rvui-brand-strong)` for press / deep ink moments, `var(--rvui-brand-soft)` for ringed soft chips and code-pill backgrounds. The Tailwind `emerald-*` palette is **aliased to the Cobalt ladder** in `apps/marketing/app/index.css`, so existing utility classes (`text-emerald-700`, `bg-emerald-50`, `ring-emerald-200`) all paint Cobalt without component edits.
- **Accent: Solar Amber.** `oklch(0.80 0.165 85)` — honey-gold complement (kept away from rusty-orange). Reserved for premium tier highlights, warning state, the hero pulse-dot, and the brand-glow press shadow. **Never** becomes a primary CTA color.
- **Neutrals are cool blue-tinted slate.** Tailwind's `gray-*` ramp is **aliased to the smoke ladder** (`oklch(L 0.025-0.032 250-260)`) so existing utilities (`text-gray-950`, `bg-gray-50`, `text-gray-600`) all read as cool slate. Admin's dark surfaces are OKLCH near-midnights (`0.16 0.030 260`) — cool blue, never warm.
- **Primitive palette stays multi-hue.** Users (Cobalt — the brand itself), Content (blue), Products (amber, the accent), Payments (cyan), Intelligence (violet). Users moved from the prior build's emerald to Cobalt, preserving the "Users is the brand color" relationship.
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
- **Section rhythm.** Every marketing section has `py-24 sm:py-32` (96/128px vertical), separated by alternating `bg-white` / `bg-gray-50` bands. **No gradients between sections.**
- **Horizontal padding.** `px-6 lg:px-8` on every section. Mobile breathes; desktop never goes edge-to-edge.

### Backgrounds

- **No full-bleed photography.** No hand-illustration. No repeating tile patterns.
- **Hero treatment** is a soft paper-to-cobalt-glow vertical wash, plus one large radial spotlight at top center painted with `var(--rvui-brand-glow)` blurred 2xl (the `from-emerald-50` Tailwind class re-resolves to a cobalt tint via the palette alias), plus the **5 ghosted heroicons of the primitives** floated at `opacity-[0.05]` and rotated. The icons are not decorative noise — they are the same 5 primitive icons repeated on the page. On dark blocks, the spotlight switches to `var(--rvui-accent-glow)` so amber does the lighting work.
- **Demo section**: dark `bg-gray-950` mat with a 2px pad around a white inner card, ringed and shadowed (`ring-1 ring-gray-950/10 shadow-2xl`). It's the only "device frame" trick on the site.
- **Dark blocks** appear as compare-cards in Problem (`bg-gray-950 text-white`), as the Pricing-highlight (`bg-gray-950`, cobalt accents inside — rendered via the `emerald-400` Tailwind alias), and as the **footer**. Dark blocks always carry cobalt accents (not cobalt-700).

### Motion

- **Easing presets.** All animation uses RevealUI's named curves: `--rvui-ease` (cubic-bezier 0.22, 1, 0.36, 1) for default, `--rvui-ease-spring` for playful overshoots, plus in/out. **No `ease-in-out`** — the curves are always shaped.
- **Durations.** `--rvui-duration-fast` 120ms, `--rvui-duration-normal` 200ms, `--rvui-duration-slow` 350ms.
- **Hero stagger.** A `hero-fade-up` keyframe (`translateY(12px)→0`, opacity 0→1, 600ms ease-out) plays on mount; nth-child(2) is delayed 120ms.
- **Pulse dot.** The single live element on the hero is the cobalt `1.5px` dot in front of the eyebrow — `animate-pulse` (Tailwind default).
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

- The codebase does not ship hero photography. Imagery is **product screenshots only** — placed inside that signature gray-950 mat.
- When an image is missing the marketing site shows a flat white inner card with the play-button overlay (the recording is "coming soon").

### Landing page structure

The marketing homepage (`HomePage.tsx`) composes these sections in this exact order:

```
Hero → Problem → Demo → Primitives → WhatsShipped → Persona →
Proof → PricingTeaser → Faq → GetStarted → Footer
```

Three are new vs the prior DS guide:

- **`WhatsShipped.tsx`** — a 9-card "capabilities, file by file" grid linking each card directly to a source file in the repo (audit chain, RBAC engine, Stripe webhook reconciliation, CRDT replay, circuit breakers, MCP hypervisor, envelope encryption, code provenance). The trust strategy is *specificity*: a buyer sees primitives most platforms ship as separate products, or never ship at all.
- **`Proof.tsx`** — three sub-blocks: live GitHub shields-badges + CI gates ("Live signals"), the tech stack card on a dark mat ("Standards your team already knows"), and a "Verifiable in three places" trio (repo / schema / production).
- **`GetStarted.tsx`** — final CTA section before the footer. Mirrors the Hero terminal pill with a longer secondary CTA path.

### Layout fixed elements

- **Sticky header** at `z-50`, height `h-16`, white-translucent + blur, bottom border `gray-950/5`.
- **Footer** is a single dark band; no sticky CTAs, no chat bubble, no cookie banner in the source.

---

## ICONOGRAPHY

### System

RevealUI uses **Heroicons** (24px outline, stroke-width 1.75 by default; 2 inside buttons). Icons are **inlined as JSX `<svg>` elements** at the call site — there is **no icon font, no sprite sheet, no Lucide/Heroicons npm dep visible in the codebase.** The codepoints are pasted into TSX files as `path d=...` blobs alongside their captions.

This means **for this design system, icons are reproduced inline** matching Heroicons' stroke style. CDN substitutes are NOT used; the codebase pattern is copy-the-path-into-the-component.

### The Five Primitive Icons (semantic, branded)

These five icons are the visual backbone of the marketing site. They appear in:
- the Hero background (rotated, `opacity-0.05`, scale 160–200px)
- the Primitives grid (40px, ringed pastel chip)
- meta links and footer columns

| Primitive | Heroicon | Accent |
|---|---|---|
| Users | `users` (variant with badge) | cobalt (brand) |
| Content | `document-text` | blue |
| Products | `archive-box` (catalog) | amber |
| Payments | `credit-card` | cyan |
| Intelligence | `sparkles` | violet |

### Logo

> ⚠️ Verify against current brand: The pre-Cobalt logo files in the source bundle (`assets/`) use off-brand palettes (rainbow medallion, indigo text logo, orange stencil wordmark, slate favicon) and are not included in this skill. The proposed brand mark is a cobalt rounded-square (`#003E7A`) with "R" in Inter Tight 800, amber dot (`#f0b519`) at bottom-right with paper ring. Render inline for any new mockups; do not reference the off-brand asset files until they are regenerated.

### Emoji & unicode

- **Emoji: never.** Confirmed across marketing site, admin app, and docs.
- **Unicode glyphs that appear:** `→` (right arrow in link CTAs, e.g. "See full pricing →"), `&times;` and `&mdash;` in copy. Checkmarks in feature lists are always **drawn as inline SVG**, never `✓`.

---

## Status & substitutions (read me)

| Item | What was used | Flag |
|---|---|---|
| Display font | **Inter Tight** | Canonical as of v4 (Cobalt). The previous Mona Sans plan was retired with the brand migration — Inter Tight is now the declared display family in `--rvui-font-display`, no fallback substitution required. |
| Icon library | inlined Heroicons paths | Codebase does not depend on `@heroicons/react`; it pastes paths inline. We follow the same pattern. |
| RevealCoin app | not extracted | The `apps/revealcoin` Solana surface is out-of-scope for this design system (separate brand layer). |
| Server / API responses | not extracted | This system is visual only; backend contracts live in `@revealui/contracts`. |
