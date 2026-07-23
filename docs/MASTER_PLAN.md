---
type: master-plan
repo: revskills
last-updated: 2026-07-23
owner: RevealUI Studio
staleness-status: FRESH
---

# RevSkills — Master Plan

**Last Updated:** 2026-07-23  
**Status:** Active — **22** skills shipped under `skills/` (pre-1.0 per skill)  
**Owner:** RevealUI Studio  
**Repo:** [RevealUIStudio/revskills](https://github.com/RevealUIStudio/revskills)

> Fleet-level plans live in the private coordination hub. This file is RevSkills-scoped only.  
> **Code-over-docs:** skill count = directories under `skills/` with a `SKILL.md`.

---

## Current reality (2026-07-23)

### What exists

22 Agent Skills compatible with Claude Code, Cursor, and the Agent Skills standard. Public install: `npx skills add RevealUIStudio/revskills`.

Categories (see root `README.md` for the live table):

- Framework & app patterns (Next, Tailwind, security)
- Data & sync (Drizzle, Electric, Yjs)
- AI & agents (MCP, multi-agent memory)
- Testing (Vitest)
- Audit & architecture (exhaustive-audit, redundancy-scan, knowledge-graph)
- Design (revealui-design + kits)
- Studio-internal workflow skills (checkpoint, snapshot, ops, doctor, recover, …)

### Residuals

| Item | Notes |
|---|---|
| Public vs Studio-internal split | Workflow skills assume RevFleet layout; generic skills stay installable |
| Continuous skill lint | Pre-push hooks in `.githooks` (skills-lint, plugin-lint, private-leak-scan) |

---

## Roadmap

| Phase | Intent | State |
|---|---|---|
| Ship core OSS skills | Next/Tailwind/Drizzle/… | Done |
| Studio workflow pack | checkpoint/doctor/ops/… | Active (expands as fleet workflow hardens) |
| 1.0 | Stable skill set + install UX | Deferred |

---

## See also

- [`../README.md`](../README.md) — install + skill index  
- [`docs/MASTER_SPEC.md`](./MASTER_SPEC.md) — skill layout contract  
