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
  version: "0.1.0"
  website: https://revealui.com
  related:
    - revealui-checkpoint
    - revealui-tracker
    - revealui-recover
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
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Render + read

```bash
CURRENT_HANDOFF="$JV_REPO/docs/handoffs/CURRENT-HANDOFF.md"
cd "$JV_REPO" && node scripts/handoff-render.js
```

Do not commit the render. Then read `$CURRENT_HANDOFF` sections **Ordered next
actions**, **Owner-gated**, **In-flight**, and the newest rolling fragment
under `docs/handoffs/rolling/`.

If the file is missing: say so, run Step 6 (TRACKER print), stop.

## Step 2 — Re-verify (mandatory)

Fragments go stale the moment the owner merges. Do not trust prose.

For every PR number named in those sections:

```bash
gh pr view <n> -R RevealUIStudio/<repo> --json state,mergedAt,mergeable,url,title
```

Repo pin: `revealui#N` → `RevealUIStudio/revealui`; `jv#N` / `revealui-jv#N`
→ `RevealUIStudio/revealui-jv`; other fleet product names as their GitHub
repos. If the fragment omits the repo, `gh pr view` the likely product first.

Also confirm named worktrees/branches still exist:

```bash
cd "$HOME/revfleet/revealui" && git worktree list
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

1. If any `agent-doable` remains: do **item 1** this session. Worktree from
   `origin/test` in the product repo. Do not dirty-switch a shared checkout.
2. Else if only `owner-gated` remains: list owner one-liners (`gh pr merge …`
   with `-R owner/repo`) and stop.
3. Else (checkpoint exhausted): Step 6.

Never merge, force-push, add gate labels, or edit a stranded `.jv` checkout
(`docs/gap-381-yml-with-render` or any `chore/checkpoint-*` main HEAD).

## Step 5 — Report

```
=== PICKUP ===
Handoff:     $JV_REPO/docs/handoffs/CURRENT-HANDOFF.md
Live:        <one line: what is still true after gh>
Doing:       <agent-doable item 1 | owner-gated wait | tracker fallthrough>
Owner-gated: <commands or none>
```

Then execute the **Doing** line (or stop on owner-gated).

## Step 6 — Fallthrough (checkpoint clear)

```bash
node "$JV_REPO/scripts/tracker.js" next
```

Print free surfaces. Do **not** auto-claim a gap. Wait for the owner to pick.

## Do not

- Do not steal `/next` or print TRACKER before finishing Steps 1–4.
- Do not paste a next-agent prompt back at the owner; this skill *is* the consume path.
- Do not start `/recover` unless git is corrupt or the owner asked.
- Do not auto-run on SessionStart.
