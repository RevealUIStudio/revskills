---
name: revealui-snapshot
description: Capture a mid-session fidelity snapshot for RevFleet sessions, keyed to a harness-neutral session id (AGENT_SESSION_ID, then REVEALUI_SESSION_ID, then CLAUDE_CODE_SESSION_ID). Assembles mechanical state and authors the five sections checkpoint consumes, writing under ~/.local/share/revealui/coordination/snapshots/$SID.md (GAP-469). Also promotes durable feedback/rule-class lessons to the memory directory. Exposed as /snapshot. MUST run this turn when a Stop hook blocks for snapshot, when a [snapshot] advisory fires, or before /compact. Producer half of GAP-317.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.3.0"
  website: https://revealui.com
---

Capture a session snapshot **while fidelity is high** — **before context compaction** — so the eventual `/checkpoint` composes its handoff from a fresh record, not from now-deep (or already-compacted) session memory. The producer half of GAP-317; `revealui-checkpoint` Step 1b is the consumer.

**This skill is mandatory this turn** when any of these fire. Do not continue other work first:

1. A Stop hook blocks with `BLOCKED: context occupancy … Run the revealui-snapshot skill NOW`
2. A `[snapshot]` advisory from `track-session.js` (Claude UserPromptSubmit; Grok discards that stdout)
3. The user runs `/compact`, or auto-compact is about to run
4. The current snapshot file has `origin: precompact-mechanical` (last-ditch hook capture — replace it with a real authoring)

The five sections are a hook-can't-author artifact: **you** assemble mechanical state and author the narrative. The file is keyed to the resolved session id (`ss_session_id`), so a peer's snapshot is structurally unreachable at consume time. Vendor env vars (e.g. `CLAUDE_CODE_SESSION_ID`) are **aliases**, not the only key (GAP-469).

Compaction path (do not weaken):

| Layer | Who | When | What |
|-------|-----|------|------|
| Force | `scripts/snapshot-before-compact.js` on **Stop** (Grok) | occupancy ≥ gate (auto-compact % minus 25, floor 50) and no agent-authored `$SID.md` | Blocks the turn until this skill writes the file |
| Nudge | `track-session.js` `[snapshot]` (Claude) | heuristic occupancy ≥ `snapshot` threshold | Advisory every prompt until the agent file exists (Grok ignores this stdout) |
| Last-ditch | same script on **PreCompact** | compact is already firing and no agent file | Writes `$SID.md` with `origin: precompact-mechanical` so checkpoint is not empty |

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


## Step 5 — Best-effort daemon dual-write (GAP-342)

After the filesystem write succeeds, dual-write the five sections into the RevDev daemon when it is running (Pro license). The file under `$WRITE_PATH` remains the skill SSOT; the daemon store is additive for Studio resume-by-id.

```bash
# Soft-fail: prints ok:… or skipped:… — never aborts the skill
ss_daemon_snapshot_write "$WRITE_PATH" "$SID"
```

Requires `~/.local/share/revealui/harness.sock` (or `REVEALUI_SOCKET` / `DAEMON_SOCKET`). Optional bind: `REVDEV_ACTOR_AGENT_ID`. Free-tier or missing socket → `skipped:…` (ok).

## Do not

- Do NOT write to any path other than `$WRITE_PATH` from `ss_snapshot_write_path` (neutral coordination root). The filename IS the id-match contract the consumer depends on.
- Do NOT ask the operator to export `AGENT_SESSION_ID` / `CLAUDE_CODE_SESSION_ID` — resolution is automatic via `ss_session_id` (GAP-469).
- Do NOT invent mechanical state — if `gh`/`git` could not answer, say so in the section rather than guessing PR numbers or branch names.
- Do NOT promote session-scoped facts to memory; only durable feedback/rule-class lessons. Over-promotion is drift.
- Do NOT skip this skill when Stop-blocked or when a `[snapshot]` advisory fires — compaction after this turn will drop session fidelity for `/checkpoint`.
- Do NOT treat a file with `origin: precompact-mechanical` as done; that is a last-ditch hook capture. Overwrite it with this skill while remainder context is still high.
- Do NOT author the five narrative sections from a hook. `scripts/snapshot-before-compact.js` may only Stop-block or write a labeled mechanical last-ditch. See GAP-317 design (`$JV_REPO/docs/gap-specs/GAP-317-session-snapshot-lifecycle-design.md`) and GAP-469 design (`$JV_REPO/docs/gap-specs/GAP-469-revskills-vendor-agnostic-design.md`).
