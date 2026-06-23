# RevealUI Design System — Claude Code context

## State as of bundle date

- **Brand:** Cobalt v4 (May 2026). Brand hue `oklch(0.36 0.190 240)` / `#003E7A` on paper, `oklch(0.58 0.150 240)` on dark (AA-compliant — lifted in shipped code, contrast issue RESOLVED). Accent: Solar Amber `oklch(0.80 0.165 85)` / `#f0b519`.
- **Type:** Inter (body), Inter Tight (display, 800 weight, `-0.02em` tracking), JetBrains Mono (code, ligatures OFF).
- **Tokens:** dark-first OKLCH, namespace `--rvui-*`, dark/light flip via `[data-theme]` + `prefers-color-scheme`. shadcn bridge in place (`--primary`, `--ring`, etc. alias to `--rvui-*`).

## Discovery order (always do this first)

Before ANY visual / UI / copy / brand decision, read these in order:

1. **`README.md`** (this skill) — canonical state. Branding, voice, primitives, sections.
2. **`@revealui/tokens/design-context/`** — the canonical token pack. A committed, CI-drift-gated pack generated from `packages/tokens/src/tokens.css` in the revealui repo / published `@revealui/tokens` package. **This is the source of truth for color, type, motion, and radii.** Read tokens from this pack; never trust a local snapshot.
3. **`SKILL.md`** (this skill) — short orientation. Brand is Cobalt; README + the design-context pack supersede any stale values.

## What's in this skill

```
revealui-design/
├── CLAUDE.md                          — you are here
├── README.md                          — full canonical doc (start here)
├── SKILL.md                           — short orientation
└── ui_kits/
    ├── marketing/                     — cobalt light marketing site (self-contained)
    │   ├── README.md
    │   ├── index.html                   open directly in browser — no external deps
    │   ├── NavBar.jsx, Hero.jsx, Primitives.jsx
    │   ├── Pricing.jsx, Faq.jsx, Footer.jsx
    └── admin/                         — cobalt dark Studio dashboard (self-contained)
        ├── README.md
        ├── index.html                   open directly in browser — no external deps
        ├── Sidebar.jsx, Topbar.jsx, Dashboard.jsx

Canonical tokens (not in this skill — read from the package):
  @revealui/tokens/design-context/
```

The ui_kits inline a minimal cobalt token subset for standalone browser use. For production work, read token values from `@revealui/tokens/design-context/` — that pack is authoritative and drift-gated by CI. Any other local token snapshot is stale.

## Open issues — work around these, don't reintroduce them

Five companion audits were produced as part of the May 2026 assessment pass. The summaries below capture what you need to know without having access to the HTML files themselves.

### Contrast & Accessibility — 5 WCAG issues remaining

- **Dark-mode brand color (RESOLVED in shipped code).** The shipped token is `oklch(0.58 0.150 240)` — lifted for AA on dark surfaces. Do not use the old value `oklch(0.46 0.180 240)`.
- **Warning text on paper fails AA.** `--rvui-warning` = `#d39a08` tests at 2.39 on paper. Use `#8a6010` (amber-700) for warning text; reserve `#d39a08` for chip backgrounds with dark text.
- **Smoke-300 as text fails AA.** `--rvui-text-2` = `#8298b3` tests at 2.83 — only safe as icon/separator/border, not as text. For tertiary text use `#4f6580` (smoke-500).
- **Status colors on dark are AA-large only.** Success (3.57), error (3.05) on midnight — only safe for ≥18pt/14pt-bold text. Use the `-subtle` variants for background fills with dark text, or lift the foregrounds.

### Dark-Mode Sweep — 24 preview cards graded

- 9 flip cleanly, 8 flip partially, 7 ignore the toggle entirely.
- Root cause is hard-coded Tailwind-flavored greys instead of tokens. **Substitution table:**

  | Hard-coded | Token to use instead |
  |---|---|
  | `#1f2937` / `#0c181e` / `#0a0e1a` | `var(--mkt-fg)` or `var(--rvui-text-0)` |
  | `#374151` / `#4b5563` | `var(--mkt-fg-body)` |
  | `#6b7280` / `#6b7d96` | `var(--mkt-fg-muted)` |
  | `#9ca3af` / `#d1d5db` | `var(--mkt-fg-subtle)` |
  | `#ffffff` / `#fff` (as surface) | `var(--mkt-bg)` or `var(--rvui-surface-1)` |
  | `#f9fafb` / `#f3f4f6` / `#fafbfc` | `var(--mkt-bg-subtle)` |
  | `#e5e7eb` (as border) | `var(--mkt-border)` |

  **NEVER write hex literals for these greys in new code.**

### Logos & Lockups — asset folder is off-brand

- Every file in the source bundle's `assets/` predates Cobalt and uses non-brand palettes (rainbow medallion, indigo text logo, orange stencil wordmark, slate favicon).
- If you need a logo, render the proposed mark inline: cobalt rounded-square (`#003E7A`) with "R" in Inter Tight 800, amber dot (`#f0b519`) at bottom-right with paper ring. Don't reference the asset files until they're regenerated.
- No OG / social card image exists yet — flag if your work needs one.

### Applied Artifacts — patterns the DS holds

Across 10 dogfooded artifacts, these patterns are universal and you should reuse them:
- Brand glyph in nav: 22×22 cobalt rounded-square, "R" in Inter Tight 800.
- Test-mode / draft amber chip: `rgba(240,181,25,0.16)` bg + `#f5d278` text.
- Brand → amber avatar gradient — ONE per surface, max.
- Right arrow (→) in CTA links — unicode glyph, not SVG.
- Checkmarks always inline SVG, never `✓`.
- Sticky nav with `backdrop-blur(12px)` is the ONLY place blur appears.

### Microcopy — string library status

- **Canonical CTA is "Start free"** — not "Talk to us about being a design partner" (the current `cta.signup` entry contradicts the README).
- **"Your role can't do that"** is anti-pattern phrasing. Use **"This action needs the admin role"** — blame the action, not the user identity.
- Missing categories (build before consuming): success & confirmations, destructive flows, loading & in-flight, agent-specific.

## Voice & content rules (non-negotiable)

| Rule | Detail |
|---|---|
| **No emoji**, anywhere | Checkmarks/close icons are always inline SVG |
| **Sentence case** for headings | h1, h2, section titles. Title case only for proper nouns + nav labels |
| **ALL CAPS** only for eyebrows | At `0.20em` letter-spacing, 11–12px size, brand color or smoke-500 |
| **Second person** for the user | First-person plural ("we") only in legal/contact contexts |
| **Operational verbs** | build, run, ship, deploy, wire, save, publish. Never revolutionize / supercharge / unleash / empower |
| **Brand casing** | `RevealUI` in prose. `REVEALUI` only for legal entity. `Rev`-prefix camel for sub-products (RevDev, RevForge, RevealCoin) |
| **Honest about status** | Stripe in test mode? Say so. Component preview? Say so. Don't hide pre-launch state |
| **Canonical CTAs** | "Start free", "See Pro pricing", "Talk to us" — never "Buy now" or "Subscribe" |
| **Numbers stay numeric** | "60 seconds", not "sixty seconds" |
| **Code names in backticks** | `npx create-revealui@latest`, `--rvui-brand` |
| **Status terms in `**bold**`** | `**Pro**`, `**TEST mode**`, `**preview**` — never colored pills outside admin UI |

## Token usage rules

- Reach for `var(--rvui-*)` first. Use shadcn bridge (`--primary`, `--ring`, etc.) where component code expects it.
- `--mkt-*` is a back-compat layer aliased to `--rvui-*` — don't author new code against it; existing code continues to work.
- Tailwind utility classes: marketing app aliases `emerald-*` to cobalt and `gray-*` to smoke. Existing utilities (`text-emerald-700`, `bg-gray-50`) resolve to cobalt/smoke and are fine; **don't add new `emerald-*` utilities** — use `cobalt-*` semantic names if introducing new ones.
- **Never write a hex literal in component code.** If the value doesn't exist as a token, add the token first.

## Before you make a change

State out loud:
1. Which DS files you read.
2. Which tokens / components you're consuming (from the design-context pack).
3. Whether your change crosses any of the five open issues above.
4. Voice/copy rules being applied (if copy is involved).

Then proceed.

---

*Bundled from the RevealUI Design System project, including the May 19, 2026 assessment pass (6 audit artifacts). Token source: `@revealui/tokens/design-context/` (committed, CI-drift-gated).*
