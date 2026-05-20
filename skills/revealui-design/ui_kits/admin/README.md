# Admin UI Kit — Studio dashboard

> **Status: starting point, not a mirror.** This kit recreates the *vocabulary* of the live `apps/admin` (dark surfaces, sidebar shape, stat-card pattern). The shipping admin app has additional surfaces this kit does **not** mirror — `src/components/revealui/{elements,icons,sections}/`, conversational dashboard, `TestModeBanner`, `UpgradePrompt`, and the surfaces documented in `apps/admin/CONVERSATIONAL-DASHBOARD-GUIDE.md`. Use this kit to *prototype against the admin's design language*, not as a one-to-one component reference.

Recreation of `apps/admin` — the dark, OKLCH-based agent ops dashboard. Uses canonical `--rvui-*` tokens directly (no marketing palette).

## Components

| File | Surface |
|---|---|
| `Sidebar.jsx` | Workspace nav (Overview/Agents) + Primitives (Users/Content/Products/Payments) + Develop section + user pill |
| `Topbar.jsx` | Breadcrumb · global search (⌘K) · LIVE badge · primary CTA |
| `Dashboard.jsx` | Stat cards w/ sparklines · Agents table with status pills |

## Conventions

- Surfaces ladder from `--rvui-surface-0` (page) → `surface-1` (panels) → `surface-2/3` (overlays).
- Borders are `--rvui-border` translucent — never solid hex on dark.
- Status pills: verdigris for running, gray for paused, red for error. Always include the leading dot.
- Mono identifiers (agent names, model names) use JetBrains Mono with ligatures off.
- Primary CTA on dark uses `--rvui-brand` solid with `--rvui-text-on-brand` text — plasma hue, never washed.
