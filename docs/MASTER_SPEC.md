---
type: master-spec
repo: revskills
last-updated: 2026-07-23
owner: RevealUI Studio
staleness-status: FRESH
---

# RevSkills — Master Spec

**Last Updated:** 2026-07-23
**Status:** Pre-1.0 per skill — surface stable, format proven across 17 skills
**Repo:** [RevealUIStudio/revskills](https://github.com/RevealUIStudio/revskills)

> SKILL.md format, distribution surface, harness compatibility. Companion to [`MASTER_PLAN.md`](./MASTER_PLAN.md) (status + roadmap).

---

## Mission

Curated [Agent Skills](https://agentskills.io) for modern web development. Built by RevealUI Studio. Compatible with Claude Code, Cursor, and any tool supporting the Agent Skills standard.

A **skill** is a unit of agent context — a markdown file with frontmatter — that an LLM tool can install, list, and invoke. Skills are NOT executable code; they're prompt-shaped guidance the agent reads when it matches the skill's `description`.

---

## Repository structure

```
revskills/
├── README.md                       # install + skill table
├── LICENSE                         # MIT
├── bin/
│   └── claude-safe                 # auto-recovery launcher (paired with revealui-recover skill)
├── scripts/                        # support scripts (e.g. publish helpers)
├── skills/                         # one directory per skill
│   ├── next-best-practices/
│   │   └── SKILL.md
│   ├── tailwind-v4/
│   │   └── SKILL.md
│   ├── ...
│   └── (17 skills total)
└── docs/
    ├── MASTER_PLAN.md              # this file's companion
    ├── MASTER_SPEC.md              # this file
    └── AUTO_RECOVERY.md            # claude-safe + recovery skill design
```

---

## SKILL.md format

Every skill is a single `SKILL.md` file with YAML frontmatter:

```markdown
---
name: next-best-practices
description: Next.js 15+ App Router best practices for pages, layouts, routes, server components, server actions, caching, API routes, and streaming. Use when building or reviewing Next.js code, implementing RSC patterns, PPR, metadata, error boundaries, or proxy.ts. Covers React 19 conventions, data fetching, ISR, and common mistakes.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Next.js Best Practices (App Router, v15+)

## Server Components (default)

- All components are Server Components by default ...
```

### Frontmatter fields

| Field | Required | Purpose |
|---|---|---|
| `name` | yes | Stable skill identifier; matches the directory name; `npx skills add ... --skill <name>` |
| `description` | yes | LLM-targeted match-trigger description; agents read this to decide whether to invoke the skill |
| `license` | yes | SPDX identifier (`MIT` for everything in this repo) |
| `allowed-tools` | no | Comma-separated tool whitelist; agents may not use tools outside this list while the skill is active |
| `metadata.author` | yes | "RevealUI Studio" for everything in this repo |
| `metadata.version` | yes | SemVer per skill; pre-1.0 default |
| `metadata.website` | no | Canonical site for the skill (or its parent project) |

### Body conventions

- **First H1**: skill title (matches `name` casing-aware)
- **Sections**: H2-headed, scannable; agents typically Ctrl-F into these
- **Code blocks**: realistic snippets, not pseudo-code
- **"When NOT to use"**: explicit anti-patterns; helps the agent decide not to invoke

---

## Distribution surface

### Bundle install

```bash
npx skills add RevealUIStudio/revskills
```

Installs all 17 skills into the agent harness's skills directory.

### Single-skill install

```bash
npx skills add RevealUIStudio/revskills --skill next-best-practices
```

### Manual install

Copy the `skills/<name>/` directory into the agent's skills directory (`~/.claude/skills/<name>/` for Claude Code, project-level `.cursor/skills/` for Cursor, etc.).

---

## Harness compatibility

| Harness | Compat | Install path |
|---|---|---|
| Claude Code | ✓ | `~/.claude/skills/<name>/` |
| Claude Code (project-level) | ✓ | `<project>/.claude/skills/<name>/` |
| Cursor | ✓ | `<project>/.cursor/skills/<name>/` |
| Other Agent Skills tools | ✓ (per agentskills.io spec) | tool-specific |

The `allowed-tools` field is enforced by harnesses that respect it (Claude Code does); harnesses without enforcement gracefully ignore it.

---

## Auto-recovery launcher (`bin/claude-safe`)

Paired with the `revealui-recover` skill. When a Claude Code session dies (crash / OOM / WSL hang), `claude-safe`:

1. `exec`s the real `claude` binary, watches exit code
2. Pass-through on `0`, `130` (SIGINT), `143` (SIGTERM)
3. On other exit codes — write a JSON crash marker (`/tmp/claude-crash-*.json`, jq-based with base64 fallback), spawn a new Windows Terminal tab running `claude 'recover'`
4. Rate-limited: 3+ crashes in 5 minutes = stop auto-relaunching
5. The recovery skill then classifies findings; if every finding is on the closed auto-heal allowlist (stale tmp files, dead-ppid cleanup, daemon re-registration), auto-proceeds; anything outside stops + asks

**Goals:** zero-touch recovery for common failure modes; user returns to either (a) work resumed with a summary or (b) a diagnostic waiting for one `y`.

**Non-goals:** not session-persistence; not tmux/pane management; context is rebuilt from rolling state snapshots and git, not serialized.

Full design in [`docs/AUTO_RECOVERY.md`](./AUTO_RECOVERY.md).

---

## Versioning

Per-skill SemVer in `SKILL.md` frontmatter `metadata.version`. Pre-1.0 default per fleet versioning conventions (SemVer 2.0.0 strict; new artifacts start at 0.1.0; promotion to 1.0.0 requires real external consumers + stable contract across at least one release cycle).

| Bump | When |
|---|---|
| Patch (0.1.0 → 0.1.1) | Doc-only edit, typo, comment |
| Minor (0.1.0 → 0.2.0) | Behavior change, new section, breaking-pre-1.0 contract change |
| Major (0.x → 1.0.0) | Promotion — only when real external consumers + stable contract for at least one release cycle |

Repo-level changes (e.g. add a new skill) ride in conventional commits with the skill name as scope: `feat(next-best-practices): add server-actions section`.

---

## License

MIT — everything in this repo. Per-skill `license: MIT` in frontmatter is canonical.

---

## Compose / coexistence

| Other product | Relationship |
|---|---|
| **RevealUI** | Several skills are RevealUI-specific (`revealui-doctor`, `revealui-recover`, `revealui-sync-lts`, `revealui-sync-rules`, `revealui-skills-test`) |
| **RevCon** | RevCon's `harnesses/skills/` carries pointers/symlinks to the skills shipped by this repo |
| **RevDev** | Studio + Console will eventually list/invoke skills via the harness daemon |
| **RevVault, RevForge, RevKit** | Independent — skills are markdown, harness-agnostic |

---

## See also

- [`docs/MASTER_PLAN.md`](./MASTER_PLAN.md) — current status, phases, owner actions
- [`docs/AUTO_RECOVERY.md`](./AUTO_RECOVERY.md) — claude-safe + recovery skill design
- [`README.md`](../README.md) — install + skill list
- RevealUI Studio internal coordination hub (private) — fleet-level navigation + versioning conventions
