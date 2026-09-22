---
name: revealui-pickup
description: >
  Consume the rolling CURRENT-HANDOFF and continue agent-doable work.
  Use when the user runs /pickup, asks to continue from checkpoint, pick up
  the last session, or resume fleet handoff work in a new session.
  Not /next (TRACKER free surfaces). Not /resume (vendor transcript).
  Not /recover (crash inventory).
license: MIT
allowed-tools: Bash, Read, Grep
metadata:
  author: RevealUI Studio
  version: "0.2.0"
  website: https://revealui.com
  related:
    - revealui-checkpoint
    - revealui-tracker
    - revealui-recover
    - revealui-cleanup
    - revealui-rollup
---

# Pickup (`/pickup`) — consume CURRENT-HANDOFF

Clean continue after `/checkpoint`. Read the rolling handoff, re-verify live
git/gh, then do remaining **agent** work. Do not invent a second board.

`/next` stays TRACKER free surfaces. `/recover` stays crash diagnostics.
Grok `/resume` and `grok --continue` reload a transcript, not this file.

Do **not** run this on SessionStart. Opening a session is not consent to
continue last night's PR.

Load helpers:
```bash
. "$REVEALFLEET_ROOT/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Render + read

```bash
CURRENT_HANDOFF="$(cd "$JV_REPO" && node scripts/handoff-render.js)"
```

Stdout is the path to read. On the shared primary checkout the renderer
writes gitignored `docs/handoffs/.CURRENT-HANDOFF.local.md` so `.jv` stays
clean. In a worktree it writes `CURRENT-HANDOFF.md` in that tree. Do not
commit the render. Then read `$CURRENT_HANDOFF` sections **Launch**,
**Ordered next actions**, **Owner-gated**, **In-flight**, and the newest
rolling fragment under `docs/handoffs/rolling/`.

If the file is missing: say so, run Step 6 (TRACKER print), stop.
If **Launch** is missing: fail closed — name that the fragment predates
ADR 2026-08-26-session-launch-record. Do not guess a product.

## Step 2 — Re-verify (mandatory)

Fragments go stale the moment the owner merges. Do not trust prose.
Classification is `handoff-status.js`, the same script the "what now?"
status line uses. Do not re-implement `gh pr view` in the session.

```bash
node "$JV_REPO/scripts/handoff-status.js"
```

`done` is merged or closed. `owner-gated` is an open pull request whose
remaining line is an owner merge, or a pull request named only under
Owner-gated. `agent-doable` is an open pull request whose ordered-next
line still says to clear, fix, push, or re-run CI.

Also confirm named worktrees/branches still exist:

```bash
cd "$REVEALFLEET_ROOT/revealui" && git worktree list
```

## Step 3 — Classify

| Class | Meaning | This session |
|-------|---------|--------------|
| `done` | Live git/gh matches the tail (merged, deleted, already applied) | Note and skip |
| `owner-gated` | Merge, vault, prod, promote, machine UAC, stranded checkout | List the one-line owner command. Do not do it |
| `agent-doable` | Spec, PR, tests, docs, conflict fix, follow-up an agent can do | Continue it |

Print a short live board. Stale fragment lines stay in the file; live state
wins.

## Step 4 — Continue

First action is CURRENT-HANDOFF **## Launch** row 1 (exact `rfg`/`rfc`
command, including `--worktree=`). That is Ordered next item 1. Then:

1. If any `agent-doable` remains after Launch: do it this session. Worktree
   from `origin/test` in the product named by Launch. Do not dirty-switch a
   shared checkout.
2. Else if only `owner-gated` remains: list the script's `gh pr merge`
   lines, then run Step 6. Do not merge. When the owner says "merged",
   re-run `handoff-status.js` and continue Step 4.
3. Else (checkpoint exhausted): Step 6.

Never merge, force-push, add gate labels, or edit a stranded `.jv` checkout
(`docs/gap-381-yml-with-render` or any `chore/checkpoint-*` main HEAD).

## Step 5 — Report

```
=== PICKUP ===
Handoff:     $CURRENT_HANDOFF
Live:        <one line: what is still true after gh>
Doing:       <agent-doable item 1 | owner-gated wait | tracker fallthrough>
Owner-gated: <commands or none>
```

Then execute the **Doing** line. On owner-gated, print the merge lines and Step 6. Do not merge.

## Step 6 — Board under the handoff

Same entry as `/next`. `sync` refreshes the board and the goals overlay.
`tracker.js next` does not.

```bash
node "$JV_REPO/scripts/tracker.js" sync
```

Print free surfaces under the handoff board. Do **not** auto-claim a gap.
Wait for the owner to pick.

## Do not

- Do not steal `/next` or print TRACKER before finishing Steps 1–4.
- Do not paste a next-agent prompt back at the owner; this skill *is* the consume path.
- Do not start `/recover` unless git is corrupt or the owner asked.
- Do not auto-run on SessionStart.
- Do not guess a product when **Launch** is missing.
- Do not rewrite tracked `CURRENT-HANDOFF.md` on the shared primary `.jv`.
- Residue after consume is `/cleanup` (report) or `/cleanup --fix` (gated). Stale MASTER_HANDOFF is `/rollup`. Do not invent a second sweep.
