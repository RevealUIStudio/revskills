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

## Contributing

PRs welcome. Each skill must:

- Have a `SKILL.md` with valid frontmatter per the [Agent Skills spec](https://agentskills.io/specification)
- Pass `skills-ref validate ./skills/<name>`
- Include keyword-rich description (this is how agents discover your skill)
- Keep body under 500 lines — move detailed reference to `references/`
- Have no project-specific references

## License

MIT

---

Part of the [RevealUI Suite](https://revealui.com) — the agentic business runtime. Build your business, not your boilerplate.
