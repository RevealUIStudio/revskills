---
name: revealui-cleanup
description: >
  One-off session residue cleanup. Alias /cleanup. Runs the GAP-314
  cleanup-session workflow (tmpscript sweep, workboard-sweep, worktree
  triage, unpushed/memory/scratchpad). Default is report-only; --fix is
  gated. Also runs from /checkpoint after prepare-for-exit (no --fix).
  Not /recover. Not /ops list.
license: MIT
allowed-tools: Bash
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
  related:
    - revealui-ops
    - revealui-checkpoint
    - revealui-rollup
---

# Cleanup (`/cleanup`) — session residue

Thin one-off onto the registered workflow `cleanup-session` (`$JV_REPO/workflows/cleanup-session.yml`). Delegates to `workflow-run.js`. Does not reimplement sweeps or safety classes.

Load helpers:
```bash
. "$HOME/revealfleet/revskills/scripts/lib/session-state.sh"
```

## Default (report)

```bash
node "$JV_REPO/scripts/workflow-run.js" cleanup-session
```

Runs the report-first arm, then `STOPPED-GATED` on the destructive arm. Print the runner output. Do not pass `--fix` unless the user asked to apply gated cleanup.

## Apply gated arms (`/cleanup --fix`)

Tell the user the gated step deletes expired temp scripts and removes only **SAFE-TO-REMOVE** worktrees (terminal PR + clean + no unpushed). Then:

```bash
node "$JV_REPO/scripts/workflow-run.js" cleanup-session --fix
```

`--dry-run` prints the plan and executes nothing.

## Where this already runs

| Surface | How |
|---------|-----|
| `/checkpoint` Step 5c2 | Same runner, **no** `--fix` |
| `/ops cleanup-session` | Same workflow by name |
| `prepare-for-exit` | Overlapping read-only checks only; not a substitute |

## Do not

- Do not call `cleanup-session.js` directly from this skill — go through the runner.
- Do not pass `--fix` from `/checkpoint`.
- Do not remove UNKNOWN or PR-OPEN worktrees.
- Do not treat this as `/recover` (crash inventory) or `/rollup` (MASTER_HANDOFF regen).
