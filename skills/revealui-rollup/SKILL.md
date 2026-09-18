---
name: revealui-rollup
description: >
  One-off MASTER_HANDOFF regen. Alias /rollup. Runs the GAP-314
  master-handoff-regen workflow (report-first sweep + regen brief; agent
  reviews then commits). Use when MASTER_HANDOFF is STALE or EXPIRED, or
  the user asks to roll up handoffs. Never auto-run from /checkpoint.
  Not /checkpoint. Not /cleanup.
license: MIT
allowed-tools: Bash, Read
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
  related:
    - revealui-ops
    - revealui-checkpoint
    - revealui-cleanup
---

# Rollup (`/rollup`) — MASTER_HANDOFF regen

Thin one-off onto the registered workflow `master-handoff-regen` (`$JV_REPO/workflows/master-handoff-regen.yml`). Delegates to `workflow-run.js`. Report-first: the script may sweep aged dated handoffs and print a regen brief; it does not silently rewrite the master body. Agent reviews, then commits on a `.jv` feature branch if a delta landed.

Load helpers:
```bash
. "$HOME/revealfleet/revskills/scripts/lib/session-state.sh"
```

## Run

```bash
node "$JV_REPO/scripts/workflow-run.js" master-handoff-regen
```

`--dry-run` on the runner prints the plan. The underlying script also accepts `--dry-run` / `--sweep-only` / `--apply-frontmatter` via its own CLI (Tier 2 escape hatch) — this skill stays on the named workflow.

## After the brief

1. Read the printed consolidation brief.
2. If a sweep moved files or a regen is required, commit **only** what the script changed, on a `chore/` branch from `origin/test`, fragments/derived per `.jv` coord rules.
3. `gh pr create --base test` with label `merge:merge-commit`. Do not self-merge.

## Where this is wired

| Surface | How |
|---------|-----|
| `/checkpoint` Step 2c | If staleness is STALE or EXPIRED, list `/rollup` under OUTSTANDING. Do **not** run it inside checkpoint. |
| `/ops master-handoff-regen` | Same workflow by name |

## Do not

- Do not run this from `/checkpoint` (expensive, owner-attended).
- Do not call `master-handoff-regen.js` from a hook.
- Do not commit `CURRENT-HANDOFF.md` as part of a rollup unless the script's own contract says so (it does not — rolling fragments stay the write surface).
- Do not treat this as `/cleanup` (session residue) or `/checkpoint` (session handoff).
