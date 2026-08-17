---
name: revealui-recover
description: Recover crashed or interrupted Studio sessions (Claude + Grok). Mandatory 72h historical inventory first. Surfaces unfinished threads, orphan artifacts, git corruption, hook residue, and workboard CRASHED markers. Diagnostic-first — never executes destructive repairs without explicit approval.
license: MIT
allowed-tools: Bash, Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.4.0"
  website: https://revealui.com
---

Recover from a crashed or interrupted **Studio** session (any equal adapter).

Power loss, battery death, and WSL death are **in scope** for this skill. `claude-safe` cannot relaunch after the machine dies; this skill still has to reconstruct work from on-disk stores. Empty `/tmp` crash markers do **not** mean nothing was lost.

Diagnostic-first: surface state, then continue unfinished **agent** work. Never execute destructive repairs without explicit approval.

Load shared helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Required first action

Run the inventory **this turn** before any "nothing to recover" claim:

```bash
node "$HOME/revfleet/revskills/scripts/recover-inventory.js" --hours 72
```

Default window is 72 hours. If the user named a longer window, pass that `--hours`.

The script is the work list. Do not substitute a memory of earlier sessions, a workboard skim, or `/tmp` crash-marker absence.

## Forbidden early exits

Never emit **No recovery needed** (Step 9 or Step 10) until all of these are true:

1. `recover-inventory.js` ran in this turn.
2. Every **unique** row is classified: `done` | `owner-gated` | `agent-unfinished` | `orphan-artifact`.
3. Every PR the inventory listed was checked live (`gh pr view N -R owner/repo`). Do not trust assistant tails.
4. `agent-unfinished` is empty, or each item is being continued in this session.
5. Recovery-artifact paths (`~/.local/share/revealui/recovery/`) are either in git or listed as `orphan-artifact` with a next action.

Cron / watcher rows are one class, not N recoveries.

## Classification (closed)

| Class | Meaning | This session does |
|-------|---------|-------------------|
| `done` | Live git/gh matches the tail (PR merged, commit on the integration ref) | Note and skip |
| `owner-gated` | Merge, vault, prod env, promote, or a human machine step | List the one-line owner command. Do not do it |
| `agent-unfinished` | Spec, PR, tests, tag, watch, or follow-up an agent can do | Continue it |
| `orphan-artifact` | File only under `recovery/`, `/tmp`, or an untracked worktree | Persist or register; do not leave silent |

## Step 0 — Identity

```bash
IDENTITY="$(ss_identity)"
SID="$(ss_session_id 2>/dev/null || true)"
echo "identity=$IDENTITY session_id=${SID:-unresolved}"
```

Known identities: `conductor`, `agent-extension[-N]`, `agent-edit[-N]`, `agent-system[-N]`, `revealui-studio`, `revealui-console`, `stagehand` (fallback). If `stagehand`, perform full (unscoped) recovery and flag that multi-agent state cannot be identity-filtered.

## Step 1 — Historical inventory (mandatory)

```bash
node "$HOME/revfleet/revskills/scripts/recover-inventory.js" --hours 72
```

Then classify every unique row using the table above. Verify named PRs live. Open recovery-artifact files (they are often the only copy of a design).

## Step 1b — Crash / session residue (multi-adapter)

**Claude adapter:**
```bash
ls /tmp/claude-crash-*.json 2>/dev/null
ls /tmp/claude-last-state-*.json 2>/dev/null
```

If a file matching `claude-crash-<IDENTITY>.json` exists, cat it, note `task`/`files`/`updated`, then delete only that identity's file after reading. Other identities: list only.

**Grok / neutral:**
```bash
[ -f "$HOME/.grok/active_sessions.json" ] && cat "$HOME/.grok/active_sessions.json"
ls "$HOME/.local/share/revealui/coordination/harness-sessions/by-pid" 2>/dev/null | head
ls /tmp/revealui-crash-*.json 2>/dev/null
```

Report Grok sessions whose `pid` is not alive (stale active_sessions rows) as WARN residue — do not delete the JSON file without owner auth.

Empty markers after reboot are expected for battery death. Continue with Step 1's inventory.

## Step 2 — Active repo + git integrity

```bash
REPO="$(ss_active_repo)"
cd "$REPO" && git status --short
cd "$REPO" && git fsck --full 2>&1 | grep -E '^(error|fatal|missing)' | head -20
ss_empty_objects "$REPO"
```

- Report uncommitted files grouped by area.
- If `git fsck` reports errors or empty objects exist: **flag as corruption**. Do not auto-repair. Propose the sequence (backup working-tree, remove empty objects, `git fetch origin`, re-verify) and ask for authorization.
- If the crash cache had a `files` list, also run `cd "$REPO" && git diff HEAD -- <files>` scoped to those paths.
- Also report dirty shared checkouts and `~/revfleet/.wt/*` that are not clean. Do not commit a dirty shared `.jv` checkout that a peer owns.

## Step 3 — Hook shared state

```bash
ss_hook_state "$PPID"
```

For each present file, read it and surface:
- `claude-agent-edits-*.json`: files the prior Claude session edited.
- `claude-autocommit-*.json`: pending auto-commit counter.
- `claude-context-*.json` / `claude-session-*.json`: turn count, tool usage.
- `revealui-session-*.id` / `revealui-daemon-session-*.id`: neutral/session caches.

Mismatch or stale counters (ppid no longer alive) indicate an unclean shutdown — note but do not modify.

## Step 4 — Run-tasks

```bash
run-task --list 2>&1
```

- `[crashed]` → propose `run-task --resume <name>` for each (don't run without user approval if the task touches shared state; auto-resume only read-only tasks).
- `[running]` → `run-task --status <name>` to confirm alive.
- `[failed:*]` / `[done:*]` → note only.

## Step 5 — Orphaned handoffs (legacy locations only)

```bash
ss_orphaned_handoffs 60
```

Surfaces legacy-location handoffs older than 60 minutes (receiving session never consumed). Scopes to:
- `/tmp/agent-handoff-*.md` — pre-2026-05-09 ad-hoc handoffs
- `$JV_REPO/.claude/handoffs/*.md` — deprecated `/handoff` slash command target (skill `revealui-handoff` v0.3.0+ DEPRECATED 2026-05-19; superseded by `/checkpoint`)

**Does NOT scan the canonical location** (`$JV_REPO/docs/HANDOFF-*.md` root, per `master-handoff.md`). Canonical-location handoffs are discoverable via the workboard `## Log` `[CHECKPOINT]` / `[HANDOFF]` entries + git history; scanning would surface every active <7d handoff as "orphaned" (wrong-by-construction — the sweep keeps active handoffs at root for 7 days).

Surface path + timestamp for each hit; propose reading. If recent canonical handoffs exist but no workboard log entry references them, that's a real orphan — surface separately by parsing `$WORKBOARD` for `[CHECKPOINT]` lines and cross-checking against `git log --since='7 days ago' -- docs/HANDOFF-*.md`.

## Step 6 — Daemon + environment

```bash
ss_daemon_alive && echo "daemon: up" || echo "daemon: DOWN"
ss_revvault_alive && echo "revvault: up" || echo "revvault: DOWN"
cd "$REPO" && test -f flake.lock && nix flake metadata --json >/dev/null 2>&1 && echo "flake: ok" || echo "flake: check"
cd "$REPO" && direnv status 2>&1 | tail -5
cd "$REPO" && pnpm -v >/dev/null 2>&1 && echo "pnpm: ok" || echo "pnpm: MISSING"
```

Report anything that would prevent the next session from running.

## Step 7 — Workboard context

```bash
ss_workboard_recent "$IDENTITY" 20
```

Look for `[CRASHED]` entries. If the most recent entry for this identity is CRASHED and all prior recovery steps come back clean, propose clearing the marker (edit `$WORKBOARD` to prefix with `[RECOVERED]` and a timestamp) — **ask first**.

## Step 8 — Relevant memory

**Claude adapter memory:**
```bash
grep -l -r "$(basename "$REPO")" "$HOME"/.claude/projects/*revfleet*/memory/ 2>/dev/null
```

**Grok:** if project memory lives under session dirs or `~/.grok`, surface paths only when present; SKIP when memory is disabled in config.

Surface feedback/rule-class files relevant to the active repo.

## Step 9 — Synthesize

Output format:

```
Recovery diagnostic complete.

Identity:   <IDENTITY>
Repo:       <REPO> (branch: <...>)
Inventory:  <N unique / N cron / N recovery-artifacts> (hours=<N>)
Unfinished: <N agent-unfinished | N owner-gated | N orphan-artifact>
Git:        <status summary | CORRUPTION: N empty objects>
Hooks:      <agent-edits: N files | autocommit: N pending>
Run-tasks:  <N crashed | N running | N done>
Handoffs:   <N orphaned>
Env:        <daemon: up/down | flake: ok/check | direnv: ok/miss | revvault: ok/down>
Last work:  <most recent workboard entry, summarized>

Classified unique sessions:
  - <sid or title>: <class> — <one line>

Findings that need authorization:
  1. <concrete action>
  ...

Suggested next: <one sentence>
```

Only after the Forbidden early exits checks pass may you say there is no unfinished agent work.

Then **continue** every `agent-unfinished` item in this session. Do not stop at the table.

## Step 10 — Auto-proceed classification (crash-triggered only)

Only runs when `$CLAUDE_CRASH_MARKER` or `$REVEALUI_CRASH_MARKER` is set (crash-triggered launcher). If unset, finish Step 9 including unfinished-work continuation; do not wait for the user to type "proceed" when the inventory already named agent-unfinished items.

Classify every finding from Steps 1–8 into two buckets using this **closed allowlist**:

**Auto-healable (safe to execute without asking):**
- Dead-ppid `/tmp/claude-*-<N>.json` or `/tmp/revealui-*-<N>.json` files (owning process not alive).
- Orphaned handoff older than 60 min — read into the response, do not auto-apply its recommendations.
- `run-task [crashed]` entries that are *read-only* by type (list/status/diagnostic).
- Workboard `[CRASHED]` → `[RECOVERED]` marker flip for THIS identity only.
- Re-registering with the RPC daemon via session-start-equivalent RPC call.
- Re-probing revvault / flake / direnv / pnpm reachability.

**Requires authorization (always stop and ask):**
- Any `git fsck` error, empty object, or missing ref.
- Any uncommitted working-tree file.
- Any `run-task [crashed]` that mutates (commits, pushes, writes shared state).
- Any file edit, `.git/` touch, force-push, reset, or branch delete.
- Any production / `.prod.` / neon.tech / supabase.co hostname in surfaced config.
- Any finding the skill does not recognize. Unknown = unsafe.

Historical unfinished threads (`agent-unfinished`, `orphan-artifact`) are **not** auto-healable. They are Step 9 continuation, not Step 10 heals.

Decision:

```
if inventory has agent-unfinished or orphan-artifact:
  emit Step 9 synthesis
  continue those items
  do not emit "No recovery needed"
elif len(authRequired) == 0 and len(autoHealable) > 0:
  emit line: "AUTO_PROCEED: <n> safe heals queued"
  execute the auto-healable list in order, reporting each
  end with one-sentence resumption note
elif len(authRequired) > 0:
  emit Step 9 synthesis with the findings-requiring-auth block populated
  stop and wait for user
else:
  emit "No unfinished agent work in the inventory window." and stop
```

Never expand the auto-healable allowlist inline in a session. If a new finding-type seems "probably safe," STOP and add it to this file in a follow-up — the closed list is the guard.

## SessionStart (adapters)

Adapters print a one-line reminder so the owner does not have to ask:

```bash
node "$HOME/revfleet/revskills/scripts/recover-inventory.js" --hours 72 --summary
```

Grok: `~/.grok/hooks/session-start.json`. Claude: `~/.claude/hooks/session-start.js`. Warn-only, fail-open, never block startup.
