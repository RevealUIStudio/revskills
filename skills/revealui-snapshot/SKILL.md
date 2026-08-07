---
name: revealui-snapshot
description: Capture a mid-session fidelity snapshot for RevFleet sessions, keyed to a harness-neutral session id (AGENT_SESSION_ID, then REVEALUI_SESSION_ID, then CLAUDE_CODE_SESSION_ID). Assembles mechanical state and authors the five sections checkpoint consumes, writing under ~/.local/share/revealui/coordination/snapshots/$SID.md (GAP-469). Also promotes durable feedback/rule-class lessons to the memory directory. Exposed as /snapshot. Nudged by the track-session context advisory at the soft-context line; the producer half of GAP-317.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.2.1"
  website: https://revealui.com
---

Capture a session snapshot **while fidelity is high** — mid-session, at the soft-context line — so the eventual `/checkpoint` composes its handoff from a fresh record, not from now-deep session memory. The producer half of GAP-317; `revealui-checkpoint` Step 1b is the consumer.

The snapshot is a hook-can't-author artifact: a hook (`track-session.js`) only nudges you here; **you** assemble the mechanical state and author the narrative. The file is keyed to the resolved session id (`ss_session_id`), so a peer's snapshot is structurally unreachable at consume time. Vendor env vars (e.g. `CLAUDE_CODE_SESSION_ID`) are **aliases**, not the only key (GAP-469).

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Pre-flight: resolve the session id + target path

```bash
SID="$(ss_session_id 2>/dev/null || true)"
if [ -z "$SID" ]; then
  echo "ABORT: could not auto-resolve session id (ss_session_id). Expected Grok active_sessions / SessionStart stamp / CLAUDE_CODE_SESSION_ID. Do not invent an id."
else
  WRITE_PATH="$(ss_snapshot_write_path "$SID")"
  SNAP_DIR="$(ss_snap_dir)"
  echo "session id (auto): $SID"
  echo "snapshot target (neutral SSOT): $WRITE_PATH"
  [ -f "$WRITE_PATH" ] && echo "(exists — this run REFRESHES it)" || echo "(new)"
  LEGACY="$(ss_snapshot_path "$SID" 2>/dev/null || true)"
  if [ -n "$LEGACY" ] && [ "$LEGACY" != "$WRITE_PATH" ]; then
    echo "note: legacy snapshot also present at $LEGACY (will not be written; prefer neutral write)"
  fi
fi
```

`ss_session_id` is **automatic** (GAP-469): vendor env aliases, SessionStart PID stamps, and Grok `~/.grok/active_sessions.json` (ancestor PID match). The operator does **not** export anything. If it aborts, stop — do not invent a filename (GAP-317 id-match contract).## Step 2 — Assemble mechanical state (cheap, factual)

Reuse the existing fleet verifier for the objective scaffold — do NOT re-derive per-repo git state by hand (a bare git loop trips the `cd`-first bash guard anyway). `prepare-for-exit.js` already reports fleet clean-checkouts, lingering worktrees, and unpushed commits:

```bash
cd "$JV_REPO" && node scripts/prepare-for-exit.js
```

Then, for each repo you actually TOUCHED this session, grab the branch + short status directly (each command `cd`-prefixed, per the fleet bash rule — never `git -C`):

```bash
cd ~/revfleet/revealui && git status -sb | head -1
```

Open PRs you authored (best-effort — skip if `gh` is slow or offline; list from memory if so):

```bash
cd ~/revfleet/revealui && gh pr list --author "@me" --state open --json number,title,headRefName --limit 20
```

## Step 3 — Author the five sections + Write the file

Using the mechanical state above plus what you actually did this session, Write `$WRITE_PATH` (from Step 1; always the neutral SSOT under `ss_snap_dir`) with **exactly** this shape (frontmatter + the five sections the checkpoint consumer maps onto the rolling handoff). Fill `<>` placeholders; never leave a section empty — write "none" if truly empty.

```markdown
---
session_id: <the $SID value>
created: <run: date -u +%Y-%m-%dT%H:%M:%SZ>
model: <your model id, e.g. claude-opus-4-8>
occupancy-pct: <the last [context] advisory pct if you saw one, else omit this line>
---

# Snapshot — <one-line session theme>

## Resume-From-Here
<The single most important thing: what the next actor does next, with exact commands / PR numbers / paths. Written so a fresh session needs nothing else to continue.>

## What-Shipped
<Merged/opened PRs with numbers, commits, what landed and where (test/main). Facts, not intentions.>

## Active-Constraints
<Load-bearing constraints in force this session: locked posture, gotchas discovered, tool/shell quirks, dirty files not to touch, peer worktrees.>

## Do-Not-Repeat
<Mistakes made + corrected this session, so the next actor does not re-make them.>

## Open-Loose-Ends
<Unfinished threads, owner-gated items, verdict-pending PRs, follow-ups filed.>
```

Refresh semantics: re-running `/snapshot` overwrites the same `$SID.md` with the current state — later in a session is more accurate, so refresh freely when the picture has materially changed.

## Step 4 — Memory promotion (owner directive: "in conjunction with memory")

Durable lessons must reach the memory directory **at snapshot time**, not only at session close. Scan what you just wrote into `## Active-Constraints` and `## Do-Not-Repeat`:

- Anything **feedback-class** (how the owner wants you to work) or **rule-class** (a durable convention) that is NOT already a memory file → write it to your Claude Code project memory directory (`~/.claude/projects/<project>/memory/<slug>.md`, the path given in your session instructions) with the memory frontmatter, and add its one-line pointer to that dir's `MEMORY.md` index. (Session-only facts stay in the snapshot; do not promote those.)
- In the snapshot, under `## Active-Constraints`, add a line `memory-promoted: [[slug-1]] [[slug-2]]` naming any memory files this snapshot spawned, so `/checkpoint` can verify the promotion happened.

Follow the memory conventions in the global instructions (one fact per file, check for an existing file to update before creating, do not duplicate what the repo/code already records).

## Do not

- Do NOT write to any path other than `$WRITE_PATH` from `ss_snapshot_write_path` (neutral coordination root). The filename IS the id-match contract the consumer depends on.
- Do NOT ask the operator to export `AGENT_SESSION_ID` / `CLAUDE_CODE_SESSION_ID` — resolution is automatic via `ss_session_id` (GAP-469).
- Do NOT invent mechanical state — if `gh`/`git` could not answer, say so in the section rather than guessing PR numbers or branch names.
- Do NOT promote session-scoped facts to memory; only durable feedback/rule-class lessons. Over-promotion is drift.
- Do NOT run this as a hook or on a timer — it is agent-authored by design (the hook only nudges). See GAP-317 design (`$JV_REPO/docs/gap-specs/GAP-317-session-snapshot-lifecycle-design.md`) and GAP-469 design (`$JV_REPO/docs/gap-specs/GAP-469-revskills-vendor-agnostic-design.md`).
