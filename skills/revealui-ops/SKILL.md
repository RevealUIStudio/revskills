---
name: revealui-ops
description: Thin shim onto the operational-workflow-layer runner (workflow-run.js). Lists registered workflows (cleanup-session, prepare-for-exit) or runs one by name, passing --dry-run/--fix/--yes straight through. Exposed as /ops. Delegates entirely to the runner — never reimplements workflow execution or safety classification (auto/report-first/gated/owner-only).
license: MIT
allowed-tools: Bash
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

Thin CLI shim onto the `.jv` operational-workflow-layer runner (`workflow-run.js`, design contract at `docs/gap-specs/GAP-314-operational-workflow-layer-design.md` §4) — exposed as `/ops`. This skill delegates entirely to the runner; it does not reimplement workflow execution, step logic, or safety classification.

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## `/ops` or `/ops list` — discovery

```bash
node "$JV_REPO/scripts/workflow-run.js" --list
```

Prints every registered workflow (name, title, and its declared `safety` — always the max severity across its steps) from `$JV_REPO/workflows/*.yml`.

## `/ops <name> [flags]` — run a workflow

```bash
node "$JV_REPO/scripts/workflow-run.js" <name> [--dry-run] [--fix] [--yes]
```

Pass `--dry-run`, `--fix`, `--yes` straight through — the runner defines what each does; this skill does not interpret them. `--dry-run` prints the plan and executes nothing.

## Safety classes (runner-enforced, not this skill)

| Class | Runner behavior |
|---|---|
| `auto` | Idempotent/read-only/report-only. Runs unattended. |
| `report-first` | Writes reviewable files (never destructive). Runs and prints; never auto-commits. |
| `gated` | Destructive or state-changing. Needs `--fix` or `--yes` for that run, or the runner prints `STOPPED-GATED` and halts the chain there. |
| `owner-only` | Disposition-shaped (per `~/.claude/rules/disposition-actions.md`) — merges, gate-clearing labels, remote branch deletes, repo settings. NEVER executed by the runner under any flag; it prints the exact command for the owner and marks `SKIPPED-OWNER`. |

## Do not

- Do NOT invoke a workflow's underlying step commands directly through this skill — always go through `workflow-run.js` so safety classification applies. The individual commands remain directly invocable outside this skill (that's Tier 2, the escape hatch); this skill is Tier 3, the named-chain path.
- Do NOT pass `--fix`/`--yes` without telling the user which gated step(s) it will unlock.
- Do NOT attempt to run an `owner-only` step's printed command through another tool on the runner's behalf — hand it to the owner verbatim, as printed.
