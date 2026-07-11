# RevSkills

[Agent Skills](https://agentskills.io) for modern web development. Built by [RevealUI Studio](https://revealui.com).

Compatible with Claude Code, Cursor, and any tool supporting the Agent Skills standard.

## Install

```bash
npx skills add RevealUIStudio/revskills
```

Install a specific skill only:

```bash
npx skills add RevealUIStudio/revskills --skill next-best-practices
```

## Skills

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

## Design

| Skill | Description |
|-------|-------------|
| [revealui-design](skills/revealui-design/) | Brand-correct UI for RevealUI Studio — Cobalt design system, voice rules, and self-contained marketing + admin UI kits |

## RevealUI Workflow (Studio-internal)

These skills assume RevFleet layout (`~/revfleet/`, `$JV_REPO`, RevVault, RevDev RPC daemon). Not generically installable — the canonical copies live here and are symlinked into `~/.claude/commands/` on Studio machines.

| Skill | Description |
|-------|-------------|
| [revealui-recover](skills/revealui-recover/) | Diagnose and recover from crashed/interrupted Claude sessions — identity, git integrity, hook state, daemon, workboard |
| [revealui-checkpoint](skills/revealui-checkpoint/) | Checkpoint checklist — validates 6 coherent-tracking surfaces, writes canonical `docs/HANDOFF-*.md`, appends workboard log entry |
| [revealui-doctor](skills/revealui-doctor/) | Health check for RevFleet Claude setup — hook syntax, rules dirs, git-fsck, workboard freshness, daemon, MCP servers, env leaks, toolchain |
| [revealui-design-status](skills/revealui-design-status/) | Check whether the claude.ai/design project changed since the codebase last pushed to it, and which files — design-to-code sync awareness (GAP-322) |
| [revealui-sync-lts](skills/revealui-sync-lts/) | **Deprecated (2026-07-02) — DR moved to weekly WSL snapshots (revkit).** Legacy per-repo LTS sync; retained for reference |
| [revealui-sync-rules](skills/revealui-sync-rules/) | Check whether `.claude/rules/` files are in sync across RevealUI repos — asks before copying |
| [revealui-skills-test](skills/revealui-skills-test/) | Static validator for Claude Code skills — flags stale paths, rule violations, missing scripts |

## Contributing

PRs welcome. Each skill must:

- Have a `SKILL.md` with valid frontmatter per the [Agent Skills spec](https://agentskills.io/specification)
- Pass `skills-ref validate ./skills/<name>`
- Include keyword-rich description (this is how agents discover your skill)
- Keep body under 500 lines — move detailed reference to `references/`
- Have no project-specific references

### Pre-push validators

After cloning, activate the committed git hooks once:

```bash
git config core.hooksPath .githooks
```

From then on, every `git push` runs three validators:

1. **skills-lint** — SKILL.md frontmatter + awk rule checks + symlink integrity (`scripts/lint-all-skills.sh`)
2. **plugin-lint** — installed Claude Code plugin validation (`scripts/lint-plugins.sh`)
3. **private-leak-scan** — repo-wide scan for leaked filesystem paths, license keys, or Vercel IDs (`scripts/check-no-private-leaks.sh`)

All three must pass. Known upstream issues and intentional Studio-internal references live in `.leakignore` / `.pluginlintignore` with documented reasons. Bypass (rare, document in the PR): `SKIP_PREPUSH=1 git push`.

## License

MIT

---

Part of the [RevFleet](https://revealui.com) — the agentic business runtime. Build your business, not your boilerplate.
