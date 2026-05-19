---
name: revealui-handoff
description: |
  DEPRECATED 2026-05-19 — prefer /prepare-archive (revealui-prepare-archive skill)
  which writes to the canonical docs/HANDOFF-*.md root location and wires 6
  coherent-tracking validators. This skill remains for backward compatibility
  but writes to the non-canonical .claude/handoffs/ location and runs no
  tracking validators. Will be removed in a future revskills major.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.3.0"
  website: https://revealui.com
  deprecated: true
  deprecated-at: "2026-05-19"
  superseded-by: revealui-prepare-archive
---

## DEPRECATED 2026-05-19

This skill writes handoffs to `~/revfleet/.jv/.claude/handoffs/` — a NON-canonical location per [`master-handoff.md`](~/revfleet/.jv/.claude/rules/master-handoff.md) (canonical = `docs/HANDOFF-*.md` root, with 7-day sweep to `docs/handoffs/archive/`).

It also runs no tracking-surface validators, so handoffs written by this skill have no `READY-TO-ARCHIVE: YES/NO` verdict and won't be caught if the session has uncommitted state or open drift.

**Prefer `/prepare-archive`** — wires 6 coherent-tracking validators + 4 inventory surfaces + writes to canonical location + outputs structured report. See [`revealui-prepare-archive/SKILL.md`](../revealui-prepare-archive/SKILL.md).

This skill remains invocable for backward compatibility (existing muscle memory; quick handoff when full pre-archive isn't needed). It will be removed in the next revskills major version after `/prepare-archive` adoption stabilizes (~Q3 2026).

---

Hand off the current session's in-flight state to a fresh agent. Studio-native: no tmux, no launch scripts. Transport is the workboard + RPC daemon (when available).

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Resolve context

```bash
IDENTITY="$(ss_identity)"
REPO="$(ss_active_repo)"
HANDOFF_DIR="$HOME/revfleet/.jv/.claude/handoffs"
mkdir -p "$HANDOFF_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
HANDOFF_FILE="$HANDOFF_DIR/${TS}-${IDENTITY}.md"
```

The handoff document lives in `~/revfleet/.jv/.claude/handoffs/` (git-tracked, survives reboot) — **not** `/tmp`.

## Step 2 — Gather state (automated)

Assemble facts from the live session:

- **Branch + diff summary**: `cd "$REPO" && git status --short && git diff HEAD --stat`
- **Staged patch** (small): `cd "$REPO" && git diff --cached | head -400`
- **Hook-tracked edits this session**: `cat /tmp/claude-agent-edits-${PPID}.json 2>/dev/null`
- **Recent workboard entries for this identity**: `ss_workboard_recent "$IDENTITY" 5`
- **Memories touched this session** (if tracked): files under `~/.claude/projects/-home-joshua-v-dev-revfleet/memory/` modified since session start
- **Open run-tasks**: `run-task --list 2>&1 | grep -E 'running|crashed'`

## Step 3 — Write handoff document

Write to `$HANDOFF_FILE` with this template (fill in the `TODO:` sections from session memory):

```markdown
---
from: <IDENTITY>
to: <suggested next identity or "ensemble">
created: <ISO timestamp>
repo: <REPO>
branch: <branch name>
---

# Handoff — <TS>

## Resume From Here
TODO: one sentence — the single most important next action. Name files, functions, commands. No vague wording.

## Active Constraints
TODO: decisions made in this session that are NOT yet committed to CLAUDE.md or MASTER_PLAN.md.

## Do Not Repeat
TODO: tried approaches, asked questions, already-rejected paths.

## Partial File State
TODO: per partially-modified file, what's done and what remains.

## Automated State
<paste from Step 2>

## Relevant Memories
<list memory files touched or surfaced this session>
```

Use the Write tool for this file.

## Step 4 — Workboard entry

Append to `$WORKBOARD` under `## Log`:
```
- [YYYY-MM-DD HH:MM] <IDENTITY>: [HANDOFF] → <handoff file path> | next: <one-line next action>
```

Use the Edit tool. Do not rewrite the workboard.

## Step 5 — Signal receiving session

If the RPC daemon is up (`ss_daemon_alive`) and `nc` is installed, notify it. Build the payload with `jq` (proper JSON escaping — paths and identities may contain special chars) and capture the exit status so Step 6 reports reality, not a false positive:
```bash
DAEMON_NOTIFIED="no"
DAEMON_NOTIFY_REASON=""
if ! command -v nc >/dev/null 2>&1; then
  DAEMON_NOTIFY_REASON="nc-missing"
elif [ ! -S "$DAEMON_SOCKET" ]; then
  DAEMON_NOTIFY_REASON="socket-absent"
elif ! command -v jq >/dev/null 2>&1; then
  DAEMON_NOTIFY_REASON="jq-missing"
else
  PAYLOAD="$(jq -cn --arg file "$HANDOFF_FILE" --arg from "$IDENTITY" \
    '{type:"handoff", file:$file, from:$from}')"
  if printf '%s\n' "$PAYLOAD" | nc -U -w 1 "$DAEMON_SOCKET" >/dev/null 2>&1; then
    DAEMON_NOTIFIED="yes"
  else
    DAEMON_NOTIFY_REASON="nc-write-failed"
  fi
fi
```
(Daemon is advisory — not required. If notification fails for any reason, the next session's SessionStart hook + `ss_orphaned_handoffs` discovery will find the handoff on the filesystem. Report the real status in Step 6 so the user isn't misled.)

If daemon is down, the handoff is still valid: the next session's SessionStart hook (or a manual `/recover`) will discover it via `ss_orphaned_handoffs 0` and the workboard log line.

## Step 6 — Report

```
Handoff written: <HANDOFF_FILE>
Workboard updated: <WORKBOARD>
Daemon notified: <DAEMON_NOTIFIED> (<DAEMON_NOTIFY_REASON> if "no")
Next session: open a fresh Studio/Claude session. It will auto-discover this handoff via /recover or SessionStart.
```

`DAEMON_NOTIFIED` is a truthful `yes` / `no` from Step 5's actual write-result. Never hardcode `yes` if the daemon wasn't notified — downstream tooling trusts this line.

Do not launch a new session. Studio-native means the user (or Studio UI) controls session creation.

## Do not
- Do not write to `/tmp/agent-handoff-*.md` — orphaned by design; use the git-tracked handoff dir.
- Do not reference tmux, tmux windows, panes, or `TMUX_PANE`.
- Do not attempt to spawn a new agent process.
