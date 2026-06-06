---
name: revealui-recover
description: Diagnose and recover from a crashed or interrupted Claude/Studio session in RevFleet. Surfaces git corruption, stale hook state, orphaned handoffs, daemon status, and workboard CRASHED markers. Diagnostic-first — never executes destructive repairs without explicit approval.
license: MIT
allowed-tools: Bash, Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.2.1"
  website: https://revealui.com
---

Recover from a crashed or interrupted Claude/Studio session. Diagnostic-first: surface state, then propose concrete next actions. Never execute destructive repairs without explicit approval.

Load shared helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Step 0 — Identity

```bash
IDENTITY="$(ss_identity)"
```

Known identities: `conductor`, `agent-extension[-N]`, `agent-edit[-N]`, `agent-system[-N]`, `revealui-studio`, `revealui-console`, `stagehand` (fallback). If `stagehand`, perform full (unscoped) recovery and flag that multi-agent state cannot be identity-filtered.

## Step 1 — Crash cache

```bash
ls /tmp/claude-crash-*.json 2>/dev/null
```

If a file matching `claude-crash-<IDENTITY>.json` exists, cat it, note `task`/`files`/`updated`, then delete. If crash caches exist for *other* identities, list them but do not delete — they belong to other agents.

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

## Step 3 — Hook shared state

```bash
ss_hook_state "$PPID"
```

For each present file, read it and surface:
- `claude-agent-edits-*.json`: list of files the prior session edited (protects against re-edit).
- `claude-autocommit-*.json`: pending auto-commit counter.
- `claude-context-*.json` / `claude-session-*.json`: turn count, tool usage.

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

```bash
grep -l -r "$(basename "$REPO")" "$HOME/.claude/projects/-home-joshua-v-dev-revfleet/memory/" 2>/dev/null
```

Surface memory files relevant to the active repo (especially `feedback_*` that might modify recovery behavior).

## Step 9 — Synthesize

Output format:

```
Recovery diagnostic complete.

Identity:   <IDENTITY>
Repo:       <REPO> (branch: <...>)
Git:        <status summary | CORRUPTION: N empty objects>
Hooks:      <agent-edits: N files | autocommit: N pending>
Run-tasks:  <N crashed | N running | N done>
Handoffs:   <N orphaned>
Env:        <daemon: up/down | flake: ok/check | direnv: ok/miss | revvault: ok/down>
Last work:  <most recent workboard entry, summarized>

Findings that need authorization:
  1. <concrete action>
  ...

Suggested next: <one sentence>
```

If all checks green and no crash markers: say "No recovery needed." in one line.

## Step 10 — Auto-proceed classification (crash-triggered only)

Only runs when `$CLAUDE_CRASH_MARKER` is set in the environment. If unset, stop after Step 9 and wait for the user.

Classify every finding from Steps 1–8 into two buckets using this **closed allowlist**:

**Auto-healable (safe to execute without asking):**
- Dead-ppid `/tmp/claude-*-<N>.json` files (the owning process is not alive).
- Orphaned handoff older than 60 min — read into the response, do not auto-apply its recommendations.
- `run-task [crashed]` entries that are *read-only* by type (list/status/diagnostic).
- Workboard `[CRASHED]` → `[RECOVERED]` marker flip for THIS identity only.
- Re-registering with the RPC daemon via `session-start.js`-equivalent RPC call.
- Re-probing revvault / flake / direnv / pnpm reachability.

**Requires authorization (always stop and ask):**
- Any `git fsck` error, empty object, or missing ref.
- Any uncommitted working-tree file.
- Any `run-task [crashed]` that mutates (commits, pushes, writes shared state).
- Any file edit, `.git/` touch, force-push, reset, or branch delete.
- Any production / `.prod.` / neon.tech / supabase.co hostname in surfaced config.
- Any finding the skill does not recognize. Unknown = unsafe.

Decision:

```
if len(authRequired) == 0 and len(autoHealable) > 0:
  emit line: "AUTO_PROCEED: <n> safe heals queued"
  execute the auto-healable list in order, reporting each
  end with one-sentence resumption note
elif len(authRequired) > 0:
  emit Step 9 synthesis with the findings-requiring-auth block populated
  stop and wait for user
else:
  emit "No recovery needed." and stop
```

Never expand the auto-healable allowlist inline in a session. If a new finding-type seems "probably safe," STOP and add it to this file in a follow-up — the closed list is the guard.
