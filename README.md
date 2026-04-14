# RevSkills

Production-grade [Agent Skills](https://agentskills.io) for modern web development. Built by [RevealUI Studio](https://revealui.com).

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

| Skill | Description |
|-------|-------------|
| [next-best-practices](skills/next-best-practices/) | Next.js 15+ App Router — RSC, PPR, caching, server actions, metadata |
| [vitest-testing](skills/vitest-testing/) | Vitest patterns — mocking, coverage, PGlite, monorepo testing |
| [drizzle-db](skills/drizzle-db/) | Drizzle ORM — schema design, migrations, queries, NeonDB |
| [security-hardening](skills/security-hardening/) | OWASP Top 10 — CSP, CORS, auth, rate limiting, XSS, CSRF |
| [tailwind-v4](skills/tailwind-v4/) | Tailwind CSS v4 — @theme, CSS-first config, CVA, migration from v3 |

## RevealUI Workflow (Studio-internal)

These skills assume the RevealUI Suite layout (`~/suite/`, `~/suite/.jv`, RevVault, RevDev RPC daemon). Not generically installable — the canonical copies live here and are symlinked into `~/.claude/commands/` on Studio machines.

| Skill | Description |
|-------|-------------|
| [revealui-recover](skills/revealui-recover/) | Diagnose and recover from crashed/interrupted Claude sessions — identity, git integrity, hook state, daemon, workboard |
| [revealui-handoff](skills/revealui-handoff/) | Strategic context handoff to a fresh session via git-tracked handoff doc + RPC daemon transport |
| [revealui-doctor](skills/revealui-doctor/) | Health check for Suite Claude setup — hook syntax, rules sync, git-fsck, LTS mode, skill self-test |
| [revealui-sync-lts](skills/revealui-sync-lts/) | Sync Suite repos to the LTS drive (/mnt/e) per per-repo `.claude/lts-mode` (bundle or mirror) |
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

Part of the [RevealUI Suite](https://revealui.com) — the agentic business runtime. Build your business, not your boilerplate.
