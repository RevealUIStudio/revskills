---
type: master-plan
repo: revskills
last-updated: 2026-08-13
owner: RevealUI Studio
staleness-status: FRESH
---

# RevSkills — Master Plan

**Last Updated:** 2026-08-13  
**Status:** Active — **24** skills shipped under `skills/` (pre-1.0 per skill)  
**Owner:** RevealUI Studio  
**Repo:** [RevealUIStudio/revskills](https://github.com/RevealUIStudio/revskills)

> Fleet-level plans live in the private coordination hub. This file is RevSkills-scoped only.  
> **Code-over-docs:** skill count = directories under `skills/` with a `SKILL.md`.

---

## Current reality (2026-08-07)

### What exists

24 Agent Skills (vendor-agnostic SSOT under `skills/`). Equal adapters: Claude Code, Grok, Cursor, OpenCode, VS Code. Public install: `npx skills add RevealUIStudio/revskills`. Claude `.claude-plugin/` is one marketplace adapter.

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
| Public vs Studio layout pack | Documented in README + MASTER_SPEC; Studio ≠ Claude-only |
| Continuous skill lint | Pre-push: skills-lint multi-home, plugin-lint in-repo `.`, leak-scan |
| Vendor program follow-ups | GAP-470/471/472 train (packaging, workflow matrix, tool map) |

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
