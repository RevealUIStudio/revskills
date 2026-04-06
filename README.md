# RevSkills

Production-grade Claude Code skills for modern web development. Built by [RevealUI Studio](https://revealui.com).

## Install

```bash
# Add the marketplace
/plugin marketplace add RevealUIStudio/revskills

# Install all skills
/plugin install revealui-web-skills@revealui-skills
```

Or install individual skills by copying the `skills/<name>/` directory into your project's `.claude/skills/`.

## Skills

| Skill | Invoke | Description |
|-------|--------|-------------|
| [next-best-practices](skills/next-best-practices/) | `/next-best-practices` | Next.js 15+ App Router patterns, RSC, caching, PPR |
| [vitest-testing](skills/vitest-testing/) | `/vitest-testing` | Vitest testing patterns, mocking, coverage, PGlite |
| [drizzle-db](skills/drizzle-db/) | `/drizzle-db` | Drizzle ORM schema design, migrations, queries |
| [security-hardening](skills/security-hardening/) | `/security-hardening` | OWASP Top 10, CSP, CORS, auth, rate limiting |
| [tailwind-v4](skills/tailwind-v4/) | `/tailwind-v4` | Tailwind CSS v4 migration, new syntax, theme vars |

## Contributing

PRs welcome. Each skill must have:
- `SKILL.md` with valid frontmatter
- Clear description (first 250 chars are shown in listings)
- No project-specific references

## License

MIT

## Part of the RevealUI Suite

RevSkills is part of [RevealUI](https://revealui.com) — the agentic business runtime. Build your business, not your boilerplate.
