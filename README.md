# RevSkills

[Agent Skills](https://agentskills.io) for modern web development. Built by [RevealUI Studio](https://revealui.com).

**Vendor-agnostic:** skill trees under `skills/` are the source of truth. Compatible with Claude Code, Grok, Cursor, OpenCode, VS Code, and any tool that implements the Agent Skills standard. The `.claude-plugin/` directory is a **Claude Code marketplace adapter**, not the only install path.

## Install

```bash
npx skills add RevealUIStudio/revskills
```

Install a specific skill only:

```bash
npx skills add RevealUIStudio/revskills --skill next-best-practices
```

### Equal-adapter paths (manual)

| Harness | Where skills typically land |
|---------|------------------------------|
| Claude Code | `~/.claude/skills/` or Studio slash links under `~/.claude/commands/` |
| Grok | `[skills].paths` → this repo, or `~/.grok/skills/` |
| Cursor | `<project>/.cursor/skills/` |
| OpenCode / VS Code | per tool Agent Skills / agent-plugin docs |

## Skills

**24** skills total. Public OSS pack needs no RevealFleet layout. Studio workflow pack assumes `~/revfleet` (and related Studio services), but not a single vendor CLI.

### Framework & app patterns

| Skill | Description |
|-------|-------------|
| [next-best-practices](skills/next-best-practices/) | Next.js 15+ App Router — RSC, PPR, caching, server actions, metadata |
| [tailwind-v4](skills/tailwind-v4/) | Tailwind CSS v4 — @theme, CSS-first config, CVA, migration from v3 |
| [security-hardening](skills/security-hardening/) | OWASP Top 10 — CSP, CORS, auth, rate limiting, XSS, CSRF |

### Data & sync

| Skill | Description |
|-------|-------------|
| [drizzle-db](skills/drizzle-db/) | Drizzle ORM — schema design, migrations, queries, NeonDB |
| [electric-sync](skills/electric-sync/) | ElectricSQL v1.x real-time sync — shapes, proxy routes, mutations, offline-first |
| [yjs-collaboration](skills/yjs-collaboration/) | Yjs CRDT collaboration — Y.Doc/Map/Array/Text, offline-first editing, conflict-free merges |

### AI & agents

| Skill | Description |
|-------|-------------|
| [mcp-server](skills/mcp-server/) | Model Context Protocol server development — JSON-RPC, tools, resources, credential isolation |
| [multi-agent-memory](skills/multi-agent-memory/) | Multi-agent shared memory — append-only facts, Yjs scratchpads, LLM-powered reconciliation |

### Testing

| Skill | Description |
|-------|-------------|
| [vitest-testing](skills/vitest-testing/) | Vitest patterns — mocking, coverage, PGlite, monorepo testing |

### Audit & architecture

| Skill | Description |
|-------|-------------|
| [exhaustive-audit](skills/exhaustive-audit/) | Multi-session full-tree audit — inventory, shards, coverage ledger, optional knowledge-graph map |
| [redundancy-scan](skills/redundancy-scan/) | Find duplication, deprecation markers, and accidental dual implementations across the fleet |
| [knowledge-graph](skills/knowledge-graph/) | Query the fleet knowledge graph (MCP `kg_*` / `revkg`) before broad greps for dependency and history questions |

### Design

| Skill | Description |
|-------|-------------|
| [revealui-design](skills/revealui-design/) | Brand-correct UI for RevealUI Studio — Cobalt design system, voice rules, and self-contained marketing + admin UI kits |

### RevealUI Workflow (Studio layout)

These skills assume RevealFleet layout (`~/revfleet/`, private planning hub, RevVault, RevDev RPC daemon). They are **equal-adapter** Studio skills (Claude, Grok, …), not Claude-only products. Canonical copies live here; Studio machines may symlink into vendor command homes.

| Skill | Description |
|-------|-------------|
| [revealui-recover](skills/revealui-recover/) | Diagnose and recover from crashed/interrupted Studio sessions (Claude + Grok markers) |
| [revealui-checkpoint](skills/revealui-checkpoint/) | Checkpoint checklist — tracking surfaces, handoff fragments, workboard log |
| [revealui-pickup](skills/revealui-pickup/) | Consume CURRENT-HANDOFF and continue agent-doable work (`/pickup`; not `/next`) |
| [revealui-snapshot](skills/revealui-snapshot/) | Mid-session fidelity snapshot for checkpoint composition (auto session id) |
| [revealui-ops](skills/revealui-ops/) | Thin `/ops` shim onto the operational-workflow-layer runner |
| [revealui-doctor](skills/revealui-doctor/) | Health check for equal-adapter Studio homes + fleet workflow |
| [revealui-design-status](skills/revealui-design-status/) | **Claude-adapter:** DesignSync / claude.ai design project change detection |
| [revealui-sync-lts](skills/revealui-sync-lts/) | **Deprecated** — DR moved to weekly WSL snapshots (revkit) |
| [revealui-sync-rules](skills/revealui-sync-rules/) | Rules distribution topology (revcon / control-layer entry preferred) |
| [revealui-skills-test](skills/revealui-skills-test/) | Static validator for Studio skill installs (multi-home + revskills SoT) |
| [revealui-tracker](skills/revealui-tracker/) | Fleet TRACKER auto-sync (`/tracker`, `/next`) |
| [revvault-resolve](skills/revvault-resolve/) | Resolve keys from revvault. Never print values. Never Stripe Projects. |

## Contributing

PRs welcome. Each skill must:

- Have a `SKILL.md` with valid frontmatter per the [Agent Skills spec](https://agentskills.io/specification)
- Pass `skills-ref validate ./skills/<name>` when that tool is available
- Include a keyword-rich description (discovery surface)
- Keep body under 500 lines — move detailed reference to `references/`
- **Public pack:** no private filesystem paths. **Studio pack:** RevealFleet layout is intentional; do not re-introduce Claude-only hard deps without an adapter label

### Pre-push validators

```bash
git config core.hooksPath .githooks
```

1. **skills-lint** — SKILL.md + optional multi-home command symlink check (`scripts/lint-all-skills.sh`)
2. **plugin-lint** — in-repo plugin metadata (`scripts/lint-plugins.sh .`; Claude cache optional)
3. **private-leak-scan** — private paths / secrets (`scripts/check-no-private-leaks.sh`)

Bypass (rare, document in the PR): `SKIP_PREPUSH=1 git push`.

## License

MIT

---

Part of the [RevealFleet](https://revealui.com) — the agentic business runtime. Build your business, not your boilerplate.
