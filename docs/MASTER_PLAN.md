---
type: master-plan
repo: revskills
last-updated: 2026-05-10
owner: RevealUI Studio
staleness-status: FRESH
---

# RevSkills — Master Plan

**Last Updated:** 2026-05-10
**Status:** Active — 17 skills shipped, pre-1.0 per skill
**Owner:** RevealUI Studio (`founder@revealui.com`)
**Repo:** [RevealUIStudio/revskills](https://github.com/RevealUIStudio/revskills)
**Fleet master index:** RevealUI Studio internal coordination hub (private)

> Fleet-level cross-cutting plans live in the RevealUI Studio internal coordination hub. This file is RevSkills-scoped only.

---

## Current Reality (2026-05-10)

### What exists

15 [Agent Skills](https://agentskills.io) shipped. Compatible with Claude Code, Cursor, and any tool supporting the Agent Skills standard. Per-skill `SKILL.md` with frontmatter-driven metadata.

### Skill inventory

#### Framework & app patterns

| Skill | Purpose |
|---|---|
| `next-best-practices` | Next.js 15+ App Router — RSC, PPR, caching, server actions, metadata |
| `tailwind-v4` | Tailwind CSS v4 — `@theme`, CSS-first config, CVA, migration from v3 |
| `security-hardening` | OWASP Top 10 — CSP, CORS, auth, rate limiting, XSS, CSRF |

#### Data & sync

| Skill | Purpose |
|---|---|
| `drizzle-db` | Drizzle ORM — schema design, migrations, queries, NeonDB |
| `electric-sync` | ElectricSQL v1.x real-time sync — shapes, proxy routes, mutations, offline-first |
| `yjs-collaboration` | Yjs CRDT collaboration — Y.Doc/Map/Array/Text, offline-first editing, conflict-free merges |

#### AI & agents

| Skill | Purpose |
|---|---|
| `mcp-server` | Build Model Context Protocol servers; tool discovery, transport, contracts |
| `multi-agent-memory` | CRDT-backed memory across multiple agents (LWW/ORSet/PNCounter) |

#### Testing

| Skill | Purpose |
|---|---|
| `vitest-testing` | Vitest patterns — mocks, fixtures, coverage, watch mode |

#### Studio operations

| Skill | Purpose |
|---|---|
| `revealui-doctor` | Diagnose common RevealUI dev-environment issues |
| `revealui-handoff` | Generate handoff docs for session close |
| `revealui-recover` | Auto-recovery flow after session crash (paired with `bin/claude-safe`) |
| `revealui-skills-test` | Test-suite skill for validating other skills |
| `revealui-sync-lts` | **Deprecated 2026-07-02** — legacy per-repo LTS sync; DR = weekly WSL snapshot (revkit) |
| `revealui-sync-rules` | Sync `.claude/rules/` files across linked targets |

### What works

| Capability | Status |
|---|---|
| `npx skills add RevealUIStudio/revskills` | ✓ — works for the whole bundle |
| `npx skills add ... --skill <name>` | ✓ — single-skill install |
| Per-skill SKILL.md with frontmatter (name, description, license, allowed-tools, metadata.version) | ✓ |
| Auto-recovery launcher (`bin/claude-safe` + `revealui-recover` skill) | ✓ — documented in `docs/AUTO_RECOVERY.md` |
| LICENSE: MIT | ✓ |

### What does not exist yet

- **Skill-spec test harness** — every skill should have a smoke-test verifying its frontmatter parses + advertised tools are available. `revealui-skills-test` is the seed; needs to be wired into CI.
- **Versioning discipline check** — every SKILL.md frontmatter has `metadata.version`; no automated check that versions follow fleet versioning conventions (SemVer 2.0.0 strict, start at 0.1.0, no premature 1.0).
- **Skill changelogs** — per-skill changelog files for ship-tracking. Currently changes ride in repo-level git history.
- **Public agentskills.io listing** — RevealUIStudio/revskills works with `npx skills add` but isn't featured on the agentskills.io directory.

---

## Composition with the rest of RevFleet

| Other product | Relationship |
|---|---|
| **RevealUI** | Primary consumer — `revealui-doctor`/`revealui-handoff`/`revealui-recover`/`revealui-sync-*` are RevealUI-specific operational skills |
| **RevDev** | Studio + Console can list/invoke skills via the harness daemon (eventually) |
| **RevCon** | RevCon's `harnesses/skills/` carries pointers to the skills shipped by RevSkills (overlap is intentional — RevCon delivers, RevSkills authors) |
| **RevVault, RevForge, RevKit** | Independent — skills are markdown, work in any environment |

---

## Active Work

### Current branch: `main` (clean)

Recent activity is per-skill iteration. No active feature branch.

### Recently shipped

- `next-best-practices`, `tailwind-v4`, `security-hardening` — framework & app patterns
- `drizzle-db`, `electric-sync`, `yjs-collaboration` — data & sync
- `mcp-server`, `multi-agent-memory` — AI & agents
- `vitest-testing` — testing
- 6 RevealUI-specific operational skills

---

## Roadmap

Pre-1.0 per skill. Each skill's promotion to 1.0.0 gated independently — real external consumers + stable contract for that skill specifically.

### Phase 0 — Skill bundle ships (DONE)

17 skills, MIT licensed, installable via `npx skills add`.

### Phase 1 — CI + versioning discipline (NOT STARTED)

| Sub-phase | Owner |
|---|---|
| Per-skill SKILL.md frontmatter validation in CI (parse + required keys) | Agent |
| Per-skill version-bump check (no jumps from 0.x to 1.0 without owner sign-off) | Agent |
| `revealui-skills-test` wired into CI to smoke-test every skill | Agent |

### Phase 2 — Per-skill changelogs (NOT STARTED)

Each skill gets a `CHANGELOG.md` next to its `SKILL.md`. Ship-tracking becomes per-skill, not repo-level.

### Phase 3 — Public agentskills.io directory listing (NOT STARTED)

Apply for / ship featured listing on agentskills.io. May need per-skill metadata adjustments depending on directory schema.

### Phase 4 — Cross-fleet skill harvesting (NOT STARTED)

Patterns proven in RevealUI development surface as shareable skills (e.g. `pglite-tests`, `nix-flakes-pnpm`, `tauri-2-react-19`). Harvest cadence: as patterns prove out across multiple PRs in the same repo, ship as a skill.

---

## Owner Action Queue

| # | Item | Unblocks | Priority |
|---|---|---|---|
| 1 | Decide whether per-skill versioning should follow strict pre-1.0 rule or allow some skills to launch at 1.0.0 from day one (only when they have proven external consumers) | Phase 1 sub-2 | Medium |
| 2 | Decide agentskills.io directory submission timing | Phase 3 | Low |

---

## Versioning

Per-skill SemVer in SKILL.md frontmatter `metadata.version`. Pre-1.0 default per fleet rule. No skill should ship at 1.0.0 without explicit promotion criteria met (real external consumers + stable contract for at least one release cycle).

---

## See also

- [`docs/MASTER_SPEC.md`](./MASTER_SPEC.md) — SKILL.md format, distribution surface, harness compatibility
- [`docs/AUTO_RECOVERY.md`](./AUTO_RECOVERY.md) — auto-recovery launcher details
- [`README.md`](../README.md) — install instructions + skill list
- RevealUI Studio internal coordination hub (private) — fleet-level navigation + versioning conventions
