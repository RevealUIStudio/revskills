---
type: master-spec
repo: revskills
last-updated: 2026-08-13
owner: RevealUI Studio
staleness-status: FRESH
---

# RevSkills — Master Spec

**Last Updated:** 2026-08-13  
**Status:** Pre-1.0 per skill — surface stable; **24** skills under `skills/`  
**Repo:** [RevealUIStudio/revskills](https://github.com/RevealUIStudio/revskills)

> SKILL.md format, distribution surface, harness compatibility. Companion to [`MASTER_PLAN.md`](./MASTER_PLAN.md).

---

## Mission

Curated [Agent Skills](https://agentskills.io) for modern web development. Built by RevealUI Studio. **Vendor-agnostic:** skills are the SSOT; Claude Code, Grok, Cursor, OpenCode, VS Code, and any agentskills.io consumer are equal adapters.

A **skill** is a unit of agent context — a markdown file with frontmatter — that an LLM tool can install, list, and invoke. Skills are NOT executable code; they're prompt-shaped guidance the agent reads when it matches the skill's `description`.

---

## Repository structure

```
revskills/
├── README.md                       # install + skill table
├── LICENSE                         # MIT
├── bin/                            # optional adapter launchers (e.g. claude-safe)
├── scripts/                        # validators + session helpers
├── skills/                         # one directory per skill (SSOT) — 22 total
│   ├── next-best-practices/
│   │   └── SKILL.md
│   └── …
├── .claude-plugin/                 # Claude Code marketplace adapter only
└── docs/
    ├── MASTER_PLAN.md
    ├── MASTER_SPEC.md              # this file
    └── AUTO_RECOVERY.md
```

---

## SKILL.md format

Every skill is a single `SKILL.md` file with YAML frontmatter:

```markdown
---
name: next-best-practices
description: Next.js 15+ App Router best practices …
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---
```

### Frontmatter fields

| Field | Required | Purpose |
|---|---|---|
| `name` | yes | Stable skill identifier; matches the directory name |
| `description` | yes | LLM-targeted match-trigger description |
| `license` | yes | SPDX (`MIT` for everything here) |
| `allowed-tools` | no | Capability whitelist (see §Tool capability map) |
| `metadata.author` | yes | "RevealUI Studio" |
| `metadata.version` | yes | SemVer per skill |
| `metadata.website` | no | Canonical site |

### Body conventions

- **First H1**: skill title  
- **Sections**: H2-headed, scannable  
- **Code blocks**: realistic snippets  
- **When NOT to use**: explicit anti-patterns  

---

## Distribution surface

**SSOT:** directories under `skills/`.

### Bundle install (preferred, multi-harness)

```bash
npx skills add RevealUIStudio/revskills
```

### Single-skill install

```bash
npx skills add RevealUIStudio/revskills --skill next-best-practices
```

### Manual install (equal adapters)

| Harness | Typical path |
|---|---|
| Claude Code (user) | `~/.claude/skills/<name>/` or `~/.claude/commands/` (Studio slash links) |
| Claude Code (project) | `<project>/.claude/skills/<name>/` |
| Grok | `~/.grok/skills/` paths or `[skills].paths` → this repo's `skills/` |
| Cursor | `<project>/.cursor/skills/` |
| OpenCode / VS Code | tool-specific Agent Skills / agent-plugin dirs |
| Generic | copy `skills/<name>/` per [agentskills.io](https://agentskills.io) |

### Claude Code plugin (adapter only)

`.claude-plugin/` is a **marketplace adapter** for Claude Code users. It is not the product center. Description/keywords may mention Claude for that storefront; README and this spec own multi-harness truth.

---

## Harness compatibility

| Harness | Compat | Notes |
|---|---|---|
| Claude Code | ✓ | Plugin adapter + skills/commands homes |
| Grok | ✓ | `[skills].paths` / thin `~/.grok` pointers to this tree |
| Cursor | ✓ | Project skills |
| OpenCode | ✓ | Agent Skills / plugin paths per tool |
| VS Code agent | ✓ | Agent plugins / skills per tool |
| Other agentskills.io tools | ✓ | Spec-defined |

---

## Tool capability map (`allowed-tools`)

Skills ship **Claude-style capability names** as the common Agent Skills dialect. Harnesses that use different tool identifiers **map or ignore** the field; they must not invent a second frontmatter schema.

| Capability | Claude dialect | Grok (illustrative) | Intent |
|---|---|---|---|
| shell | `Bash` | `run_terminal_command` | Run shell commands |
| read | `Read` | `read_file` | Read files |
| search | `Grep`, `Glob` | `grep`, `list_dir` | Search / list |
| edit | `Write`, `Edit` | `search_replace`, `write` | Mutate files |

Enforcement: only harnesses that honor `allowed-tools` restrict tools; others ignore gracefully.

---

## Public OSS pack vs Studio workflow pack

| Pack | Skills | Assumptions |
|---|---|---|
| **Public / OSS** | next, tailwind, drizzle, electric, yjs, mcp, multi-agent-memory, vitest, security, exhaustive-audit, redundancy-scan, knowledge-graph, revealui-design | No RevFleet layout required |
| **Studio workflow** | revealui-checkpoint, snapshot, doctor, recover, ops, skills-test, sync-rules, sync-lts (deprecated), design-status, tracker, revvault-resolve | `~/revfleet`, `.jv`, revvault, RevDev — **layout**, not "Claude only" |

Studio skills must still be **vendor-agnostic** across Claude / Grok / equal adapters (GAP-469+).

---

## Auto-recovery launchers

`bin/claude-safe` is the **Claude Code adapter** for crash recovery (see [`AUTO_RECOVERY.md`](./AUTO_RECOVERY.md)). Grok and other harnesses recover via `/recover` (or harness-native session restore) without that binary. Multi-harness notes live in AUTO_RECOVERY.md.

---

## Versioning

Per-skill SemVer in `metadata.version`. Pre-1.0 default. Skill count = `find skills -name SKILL.md | wc -l` (currently **24**).

---

## License

MIT — everything in this repo.

---

## Compose / coexistence

| Other product | Relationship |
|---|---|
| **RevealUI** | Studio workflow skills target the fleet layout |
| **RevCon** | Profiles / harness content may pointer into this tree |
| **RevDev** | Future list/invoke via daemon |
| **RevVault, RevForge, RevKit** | Independent — skills stay markdown |

---

## See also

- [`docs/MASTER_PLAN.md`](./MASTER_PLAN.md)  
- [`docs/AUTO_RECOVERY.md`](./AUTO_RECOVERY.md)  
- [`README.md`](../README.md)  
