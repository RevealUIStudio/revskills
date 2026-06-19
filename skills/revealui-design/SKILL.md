---
name: revealui-design
description: Use this skill to generate well-branded interfaces and assets for RevealUI Studio, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, and brand voice rules for the RevealUI design system (Cobalt brand, dark-first OKLCH tokens). Read README.md for the full canonical doc and CLAUDE.md for brand orientation, voice rules, and assessment summaries.
user-invocable: true
license: MIT
allowed-tools: Read, Grep, Glob, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.1.2"
  website: https://revealui.com
---

Read the README.md file within this skill for canonical brand, voice, and visual foundations.
Read CLAUDE.md for brand orientation, open issues, voice rules, and substitution tables.

For canonical tokens, read from `@revealui/tokens/design-context/` — a committed, CI-drift-gated pack generated from the revealui repo's `packages/tokens/src/tokens.css`. Do not rely on local token snapshots.

This skill includes cobalt starting-point UI kits:
- `ui_kits/marketing/` — light marketing site recreation (NavBar, Hero, Primitives, Pricing, Faq, Footer)
- `ui_kits/admin/` — dark Studio dashboard recreation (Sidebar, Topbar, Dashboard)

Open `ui_kits/marketing/index.html` or `ui_kits/admin/index.html` directly in a browser — both are self-contained (no external file dependencies). Use these as cobalt starting points; for production work read token values from the design-context pack.

RevealUI is dual-surface:
- **Marketing site** (revealui.com) — cool paper + cobalt-ink + amber-accent, Tailwind utilities (emerald-* and gray-* aliased to cobalt/smoke)
- **Admin / Studio** (admin.revealui.com) — dark, OKLCH-based `--rvui-*` tokens, Cobalt brand

Brand: **Cobalt (Electric Verdigris)** — `--rvui-brand: oklch(0.36 0.190 240)` on light surfaces, `oklch(0.58 0.150 240)` on dark (AA-compliant). Accent: Solar Amber `oklch(0.80 0.165 85)`.

Type stack: Inter (sans), Inter Tight (display, 800 weight, -0.02em tracking), JetBrains Mono (mono, ligatures OFF). Brand signature: the `npx create-revealui@latest my-app` terminal pill on the marketing hero — reuse it verbatim when relevant.

If creating visual artifacts (slides, mocks, throwaway prototypes), create static HTML files for the user to view. Use the ui_kits as cobalt starting points or build from scratch using token values from the design-context pack.

If the user invokes this skill without other guidance, ask what they want to build or design (marketing landing? admin dashboard? blog post template? slide deck?), ask some questions, and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
