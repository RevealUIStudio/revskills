---
name: revealui-checkpoint
description: Checkpoint checklist for revealfleet sessions. Validates the 6 coherent-tracking surfaces, inventories tracking state, writes a rolling handoff fragment + workboard log fragment in an isolated worktree, re-renders CURRENT-HANDOFF and the neutral .revealui workboard there for read convenience, and commits only the two exact fragments per ADR 2026-07-23-jv-coordination-merge-model. Never commits derived CURRENT-HANDOFF.md or workboard.md. Never master-handoff regen or auto-merge with --admin.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.16.6"
  website: https://revealui.com
---

Checkpoint orchestrator. Run before ending a meaningful session to ensure the next agent can pick up cleanly. Wires together the 6 coherent-tracking validators + 4 inventory surfaces + writes a **rolling handoff fragment** (`docs/handoffs/rolling/`) + a workboard log fragment (`.revealui/workboard.d/`) from an isolated worktree, **renders** CURRENT-HANDOFF and the neutral workboard there for read convenience, and **commits only the two exact fragment files** (ADR `2026-07-23-jv-coordination-merge-model` / jv#601). Concurrent sessions use separate worktrees; unique fragment filenames merge without rewriting shared derived files. Then reports CHECKPOINT-READY + emits the archive-readiness next-agent prompt.

This skill is human/agent handoff. It is not `rfloop`. rfloop is a PR/CI operator disk state machine only (P0 stub; no LLM; auto-merge locked). It is not the fleet brain or the product AgentRuntime. Prefer `rfloop`; `revloop` is a rename shim.

Policy home is `$JV_REPO/.revealui` (manager and content) before any vendor tree. Read location and handoff tiers there first. Active handoffs stay at `docs/HANDOFF-*.md`; archive stays at `docs/handoffs/archive/`. `$JV_REPO/.claude/rules/master-handoff.md`, `$JV_REPO/.claude/rules/jv-doc-locations.md`, and `~/.claude/rules/` (including `model-allocation.md`) are Claude adapter attach copies, not the policy home. `$JV_REPO/.claude/workboard.md` is adapter render only.

Load helpers:
```bash
. "$REVEALFLEET_ROOT/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Resolve context

```bash
IDENTITY="$(ss_identity)" || {
  echo "checkpoint: no validated harness identity or session id; stop before writing fragments" >&2
  exit 1
}
SID="$(ss_session_id)" || {
  echo "checkpoint: no validated session id; stop before writing fragments" >&2
  exit 1
}
REPO="$(ss_active_repo)"
JV_ROOT="$JV_REPO"
# Write SSOT (session-state defaults). Do not point these at a vendor path.
WORKBOARD_D="${WORKBOARD_D_NEUTRAL:-$JV_ROOT/.revealui/workboard.d}"
WORKBOARD="${WORKBOARD_NEUTRAL:-$JV_ROOT/.revealui/workboard.md}"
# Adapter render/attach only. Not the write SSOT. Not policy.
WORKBOARD_ADAPTER="${WORKBOARD_ADAPTER_CLAUDE:-$JV_ROOT/.claude/workboard.md}"
ISO_DATE="$(date -u +%Y-%m-%d)"
ISO_DATETIME="$(date -u +%Y-%m-%dT%H:%MZ)"
# The shared render may be stale; Step 5b sets CURRENT_HANDOFF to its isolated render.
SHARED_HANDOFF="$JV_ROOT/docs/handoffs/CURRENT-HANDOFF.md"
```

Rolling handoff **read surface** (rendered): the checkpoint worktree's `docs/handoffs/CURRENT-HANDOFF.md`. **Durable write surface:** `docs/handoffs/rolling/<ISO>-<id>.md` only. `~/.claude/rules/model-allocation.md` may restate the handoff loop; that file is adapter attach, not policy. Every session adds a fragment rather than creating a dated handoff file. Renderer caps history (`--max`, default 12); optional `--gc` archives rolling fragments older than 7d (Step 4b). Workboard durable writes go to the worktree's `.revealui/workboard.d`. Neutral and adapter renders remain local, derived views.

## Step 1b — Load the auto-checkpoint snapshot (fidelity source)

A session snapshot is captured **before context compaction** by the `/snapshot` skill (Grok Stop-gate at the occupancy gate; Claude `[snapshot]` advisory; PreCompact mechanical last-ditch). When one exists it is the PRIMARY source for the narrative sections in Step 4 — more trustworthy than reconstructing from now-deep or already-compacted session memory.

The gate tracks the control-layer token budget (`token-economy`, authored in `packages/harnesses/src/token-budget.ts`). RevKit writes that budget into `~/.grok/config.toml` (`compaction_at_tokens` and `auto_compact_threshold_percent`). The Stop gate fires `snapshotHeadroomTokens` before compact. A checkpoint whose snapshot says `origin: precompact-mechanical` means compact won the race; say so in the fragment.

Resolve it by **this session's id, never by mtime** — a peer's snapshot must be structurally unreachable (GAP-317 + GAP-469). Session id and paths come from `session-state.sh` (neutral SSOT under `~/.local/share/revealui/coordination/`, with read-through of the legacy Claude adapter path).

**Load order (GAP-342 residual):** prefer the filesystem SSOT when present; if the file is missing, best-effort hydrate from daemon `session.snapshot.get` by the same id into the neutral write path (`ss_snapshot_load_path`). Never mtime, never another session's file.

```bash
SNAPSHOT=""
if [ -n "$SID" ]; then
  # Prefers file SSOT; hydrates from daemon by id when file missing (soft-fail).
  SNAPSHOT="$(ss_snapshot_load_path "$SID" 2>/dev/null || true)"
  # Fallback for older session-state without load helper:
  if [ -z "$SNAPSHOT" ]; then
    SNAPSHOT="$(ss_snapshot_path "$SID" 2>/dev/null || true)"
  fi
fi
if [ -n "$SNAPSHOT" ]; then
  echo "snapshot for this session: $SNAPSHOT (sid=$SID)"
  if grep -q '^origin: precompact-mechanical' "$SNAPSHOT"; then
    echo "WARNING: origin=precompact-mechanical — last-ditch hook capture, lower fidelity. Prefer an agent-authored /snapshot if one can still be written."
  fi
else
  echo "no snapshot for this session ($SID) — Step 4 falls back to session memory"
fi
```

If `$SNAPSHOT` is set it is unambiguously THIS session's (the filename equals the resolved session id), so no content-matching guesswork is needed. READ it and use its five sections (Resume-From-Here, What-Shipped, Active-Constraints, Do-Not-Repeat, Open-Loose-Ends) as the spine of the Step 4 merge; they map onto the rolling file's sections. If frontmatter has `origin: precompact-mechanical`, say so in the fragment (lower fidelity; compaction fired before agent authoring). With no snapshot — occupancy never hit the gate or `/snapshot` was not run — Step 4 proceeds from session memory. Do **not** abort solely because `CLAUDE_CODE_SESSION_ID` is unset when another validated alias is present. Do NOT fall back to the most-recent file on disk; an unmatched id means no snapshot for this session.

## Step 2 — Run coherent-tracking validators

Capture pass/fail per check. Do NOT auto-fix anything destructive.

### 2a. Doc locations
```bash
cd "$JV_ROOT" && "$REVEALFLEET_ROOT/revealui/node_modules/.bin/tsx" scripts/doc-locations-check.ts --quiet
```
Exit 0 = clean. Exit 1 = drift (e.g., handoffs at `docs/handoffs/` top-level, lane plan missing).

### 2b. Workboard freshness
```bash
node "$JV_ROOT/scripts/workboard-check.js"
```
Read-only. Warns on stale Active Sessions / Coordination Notes / Log entries. Never blocks.

### 2c. MASTER_HANDOFF staleness
```bash
node "$JV_ROOT/scripts/master-handoff-staleness.js"
```
Recomputes `staleness-status` (FRESH / STALE / EXPIRED) in `docs/MASTER_HANDOFF.md` frontmatter. Read-only against body. If the result is STALE or EXPIRED, list `/rollup` under OUTSTANDING — do **not** run `master-handoff-regen` inside checkpoint (skill `revealui-rollup`).

### 2d. Lane plans
```bash
node "$JV_ROOT/scripts/lanes-check.js"
```
Validates each lane's frontmatter + plan.md presence.

### 2e. M-1 ADR tracking-issue compliance
```bash
TSX="$REVEALFLEET_ROOT/revealui/node_modules/.bin/tsx"
# revealui-jv default branch is `test`; origin/main is not a ref. Prefer a
# resolvable origin/test, then origin/main. The checker also falls back if the
# named ref is missing (dangling origin/HEAD used to point at origin/main).
BASE_REF=origin/test
if ( cd "$JV_ROOT" && git rev-parse --verify --quiet origin/test >/dev/null 2>&1 ); then
  BASE_REF=origin/test
elif ( cd "$JV_ROOT" && git rev-parse --verify --quiet origin/main >/dev/null 2>&1 ); then
  BASE_REF=origin/main
fi
"$TSX" "$JV_ROOT/scripts/m1-adr-tracking-check.ts" --base-ref="$BASE_REF" --head-ref=HEAD --mode=ci
```
Every ADR (post-2026-05-16 cutoff) must carry `tracking-issue:` frontmatter. The check needs a diff range: `<default-branch>...HEAD` (empty range → exit 0). Invoking it with no range exits 2 with a usage error — that was the Step 2e bug, fixed 2026-06-06. Do not hardcode `origin/main` on repos whose GitHub default branch is `test`.

### 2f. M-1 frontmatter staleness
```bash
"$REVEALFLEET_ROOT/revealui/node_modules/.bin/tsx" "$JV_ROOT/scripts/m1-frontmatter-staleness-check.ts" --mode=ci
```
Lane plan `last-updated:` must not be older than the most-recent ADR's `date:` field.

## Step 3 — Inventory tracking state

Surface what's currently tracked. Read-only.

### 3a. branches.json — active branches
```bash
BRANCHES_JSON="$(ss_branches_json)"
if [ -f "$BRANCHES_JSON" ] && command -v jq >/dev/null 2>&1; then
  ACTIVE_COUNT="$(jq '.branches | map(select(.status == "active")) | length' "$BRANCHES_JSON")"
  echo "active branches: $ACTIVE_COUNT (from $BRANCHES_JSON)"
  jq -r '.branches | map(select(.status == "active")) | .[] | "  - \(.project):\(.branch) (\(.pr // "no PR"))"' "$BRANCHES_JSON"
fi
```

### 3b. Open PRs across RevealFleet repos
```bash
for repo in revealui revealui-jv revvault revdev revforge revkit revskills revcon; do
  count="$(gh pr list --repo RevealUIStudio/$repo --state open --json number 2>/dev/null | jq 'length' 2>/dev/null)"
  if [ "${count:-0}" != "0" ]; then
    echo "$repo: $count open"
    gh pr list --repo RevealUIStudio/$repo --state open --json number,title,headRefName --jq '.[] | "  - #\(.number) \(.title) [\(.headRefName)]"' 2>/dev/null
  fi
done
```

### 3c. .jv git state
```bash
cd "$JV_ROOT" && git -c core.fileMode=false status --short && echo "---" && git log --oneline -5
```

### 3d. Active lanes (from INDEX)
```bash
# Count rows in the generated lanes-index block.
awk '/^<!-- BEGIN GENERATED:lanes-index -->/,/^<!-- END GENERATED:lanes-index -->/' "$JV_ROOT/docs/lanes/INDEX.md" | grep -cE '^\| [a-z][a-z0-9-]+ \|'
```

### 3e. Master tier-1 surfaces
```bash
# DIRECTION.md last-modified mtime — flag if updated this session.
stat -c '%Y' "$JV_ROOT/.claude/DIRECTION.md"
# MASTER_PLAN.md staleness check is part of M-1 (covered by 2f).
```

### 3f. Pending hotfixes → durable (GAP-405; read-only)

Surface registered debt so wrap-up cannot clear without naming the durable follow-up. **Prefer durable root-cause fixes; registry is admitted debt only.** Control layer: `revealui-harnesses hotfix` (store `~/.local/share/revealui/hotfixes`). Adapter thin entry still works.

```bash
# Prefer control-layer CLI; fall back to Studio adapter (forwards to control layer).
if command -v revealui-harnesses >/dev/null 2>&1 && revealui-harnesses hotfix store >/dev/null 2>&1; then
  revealui-harnesses hotfix check 2>/dev/null || true
  revealui-harnesses hotfix list 2>/dev/null || true
elif [ -f "$HOME/.claude/scripts/hotfix.js" ]; then
  node "$HOME/.claude/scripts/hotfix.js" check 2>/dev/null || true
  node "$HOME/.claude/scripts/hotfix.js" list 2>/dev/null || true
else
  echo "hotfix control CLI missing — build @revealui/harnesses (GAP-405)"
fi
```

Read-only. Capture output for Step 6 **HOTFIXES** and Step 4 fragment **Owner-gated** / **Outstanding** when any entry is `pending`. Do **not** call `resolve` here. Pending entries never block CHECKPOINT-READY alone, but they **must** appear under OUTSTANDING.

### 3g. Live peer refresh (GAP-494)

Overwrite **this session's** `workboard.d/active` row so peers see the claim. Does not commit (Step 5b does). Do not run a nested `/coordinate` full skill.

```bash
node "$REVEALFLEET_ROOT/revskills/skills/revealui-coordinate/scripts/coordinate.js" \
  --mode=refresh --id "$SID" --claim "<this session claim>"
```

Live `/coordinate` is the manual skill. This step is the checkpoint slice only.

## Step 4 — Write rolling handoff fragment + local render

**Contention-free path (2026-07-21, amended 2026-07-23):** do **not** hand-edit `$SHARED_HANDOFF`. Write a **new fragment** under `docs/handoffs/rolling/` in the isolated worktree, then render there for the report/prompt. Sibling of workboard fragments (ADR 2026-07-04). **Do not commit the render** (ADR 2026-07-23-jv-coordination-merge-model; CI `Coord paths guard` fails PRs that edit `CURRENT-HANDOFF.md` / `workboard.md`).

Compose the delta PRIMARILY from the Step 1b snapshot when present, supplemented by session memory + Step 2-3 results. With no snapshot, fall back to session memory.

**Security content: CITE, don't restate (owner ruling 2026-07-16).** When the session touched security findings / exploits / confinement / crypto, the delta references the artifact only — never re-describes the technique. Applies to the fragment, the workboard log (Step 5), and the next-agent prompt (Step 8).

### 4a. Write the fragment

```bash
# Compose body with at least ## Last merge (renderer extracts it for the top block)
# and ## Launch (product + exact rfg/rfc command). ADR 2026-08-26-session-launch-record.
# Include Live board / In-flight / Ordered next / Owner-gated as needed.
HANDOFF_BODY="$(cat <<'EOF'
## Last merge

<ISO_DATE> — <IDENTITY>: <≤15 words what landed>

## Launch

| Product | Command |
|---------|---------|
| <rfg basename> | `rfg <product> [--worktree=<label>]` |

## Live board

| Surface | State |
|---------|--------|
| … | re-verify with gh |

## In-flight

- …

## Ordered next actions

1. <exact Command from ## Launch row 1>

## Owner-gated

- …

## Pending hotfixes (if any from Step 3f)

- none | list id — title — durable target
EOF
)"
# Step 5b writes the composed body to an isolated worktree and prints its
# exact fragment path. Do not write this session's fragment in the shared
# .jv checkout before the worktree exists.
```

Never create a dated `docs/HANDOFF-YYYY-MM-DD-*.md` for the rolling train. Prefer session-specific truth in the **fragment** (unique path). A later checkpoint fetches `origin/test` into its own worktree and renders landed fragments there.

### 4b. Size control

Rolling history is capped by `handoff-render.js --max` (default 12 fragments). Older fragments age out with `--gc` (7-day mtime → `docs/handoffs/archive/rolling/`). Do not hand-prune GENERATED blocks.

## Step 5 — Workboard log entry

**Compose** this session's Log line (do NOT hand-edit `## Log` — the workboard `## Log` block is now GENERATED from per-session fragments per ADR `2026-07-04-workboard-fragment-store`, the contention-free write path):
```
- [YYYY-MM-DD HH:MM] <IDENTITY>: [CHECKPOINT] → rolling fragment only | tracking: <X pass / Y fail> | next: <one-line next action from §Ordered next actions>
```

Step 5b writes it as a **fragment** (`.revealui/workboard.d/log/<ts>-<id>.md`, a new per-session file that can never collide with a peer) and re-renders the neutral `.revealui/workboard.md` **locally only**, in the isolated worktree. A second render to `.claude/workboard.md` is adapter attach only. Set the volatile parts **as single-quoted literals** so a next-action containing backticks / `$(…)` / quotes is never command-substituted (`§Ordered next actions` holds exact commands + paths, which routinely use backticks):
```bash
TS="$(date -u '+%Y-%m-%d %H:%M')"
TRACK='<X pass / Y fail>'
NEXT='<one-line next action from §Ordered next actions>'   # single-quoted literal; a literal ' inside → close+reopen: '\''
```
Step 5b assembles the line with `printf` (never re-evaluates), passes it to the maintained `checkpoint-prepare.sh`, and writes a fresh workboard fragment in the isolated worktree. It never edits the shared `workboard.md` or stages a peer's dirty files.

## Step 5b — Write and publish exact fragments from an isolated worktree

Every harness uses the same path, including Codex. Process counts cannot prove
exclusive ownership: subagents may share a process, and a peer may start after
any check. The publication path treats the shared `.jv` checkout as a read
surface; Step 3g's maintained live-claim refresh is separate. A checkpoint
never switches the shared checkout's branch, fast-forwards it, stages its
files, or commits in it.
Always create a fresh worktree from the fetched `origin/test` ref. This works
even when the shared checkout is dirty or diverged. Do not call the old
`jv-single-writer-check.js --count` branch selector; that script has no count
mode and is only an advisory warning.

Use the exact paths printed by the maintained fragment writers. A directory
pathspec such as `git add docs/handoffs/rolling .revealui/workboard.d` can stage
another session's untracked fragments. Derived renders are local read surfaces
and never part of the commit. `--no-commit` performs the same isolated writes
but leaves the worktree and its two untracked fragments for owner review.

```bash
set -euo pipefail
HANDOFF_INPUT="$(mktemp /tmp/revealfleet-checkpoint-handoff.XXXXXX)"
WORKBOARD_INPUT="$(mktemp /tmp/revealfleet-checkpoint-workboard.XXXXXX)"
printf '%s\n' "$HANDOFF_BODY" >"$HANDOFF_INPUT"
printf -- '- [%s] %s: [CHECKPOINT] → rolling fragment only | tracking: %s | next: %s\n' \
  "$TS" "$IDENTITY" "$TRACK" "$NEXT" >"$WORKBOARD_INPUT"
# Set CHECKPOINT_NO_COMMIT=1 only for the skill's --no-commit invocation.
PREP_ARGS=()
if [ "${CHECKPOINT_NO_COMMIT:-0}" != 1 ]; then PREP_ARGS+=(--stage); fi
if ! PREP_OUTPUT="$(bash "$REVEALFLEET_ROOT/revskills/scripts/checkpoint-prepare.sh" \
  --jv-root "$JV_ROOT" --identity "$IDENTITY" \
  --handoff-body-file "$HANDOFF_INPUT" \
  --workboard-line-file "$WORKBOARD_INPUT" "${PREP_ARGS[@]}")"; then
  rm -f "$HANDOFF_INPUT" "$WORKBOARD_INPUT"
  exit 1
fi
rm -f "$HANDOFF_INPUT" "$WORKBOARD_INPUT"
mapfile -t PREP_FIELDS <<< "$PREP_OUTPUT"
[ "${#PREP_FIELDS[@]}" -eq 4 ] || { echo 'checkpoint: invalid prepare result' >&2; exit 1; }
BR="${PREP_FIELDS[0]}"; WT="${PREP_FIELDS[1]}"
HANDOFF_PATH="${PREP_FIELDS[2]}"; WORKBOARD_PATH="${PREP_FIELDS[3]}"
HANDOFF_REL="${HANDOFF_PATH#"$WT"/}"
WORKBOARD_REL="${WORKBOARD_PATH#"$WT"/}"
CURRENT_HANDOFF="$WT/docs/handoffs/CURRENT-HANDOFF.md"
node "$WT/scripts/handoff-render.js" --base "$WT/docs/handoffs/rolling" \
  --out "$CURRENT_HANDOFF"
node "$WT/scripts/workboard-sweep.js" --render-only \
  --workboard "$WT/.revealui/workboard.md" --base "$WT/.revealui/workboard.d"
node "$WT/scripts/workboard-sweep.js" --render-only \
  --workboard "$WT/.claude/workboard.md" --base "$WT/.revealui/workboard.d"
```
For `--no-commit`, stop here. Report `$WT`, `$HANDOFF_PATH`, and
`$WORKBOARD_PATH` under OUTSTANDING. Do not archive the session snapshot until
the fragments are committed and published. For the default path, compose a
commit message and PR body in a file outside the worktree, then continue:

```bash
# CMSG is a unique, session-owned text file containing the reviewed commit
# message and PR body. Never include security technique details.
CMSG="$(mktemp /tmp/revealfleet-checkpoint-message.XXXXXX.txt)"
# Write the actual message to $CMSG before continuing.
cd "$WT"
# The prepare helper staged only the two exact files in this fresh worktree.
# Review those staged names and content before the real signed commit.
git diff --cached --name-only
git diff --cached --check
git -c core.fileMode=false commit -F "$CMSG" -- \
  "$HANDOFF_REL" "$WORKBOARD_REL"
git push origin "HEAD:refs/heads/$BR"
REPO_SLUG="$(cd "$WT" && gh repo view --json nameWithOwner --jq .nameWithOwner)"
PR_URL="$(cd "$WT" && gh pr create --repo "$REPO_SLUG" --draft --base test \
  --head "$BR" --body-file "$CMSG")"
gh pr edit "$PR_URL" --repo "$REPO_SLUG" --add-label "merge:merge-commit"
rm -f "$CMSG"
# Stop here unless the owner named an in-session merge disposition.
```

The PR uses merge-commit disposition on `.jv`; never use `--admin`,
`--no-verify`, squash, or force push. The owner handles merge. Keep the
worktree registered in `git worktree list` until PR disposition, then retire
it through the maintained cleanup-session workflow. On failure, report its
path and preserve the authored delta. Do not silently swallow fetch, worktree,
push, or PR errors. Do not refresh derived files in the shared checkout while
it has another session's edits; the isolated render is the report's read view.

## Step 5c — Prepare-for-exit verifier (read-only, runs after 5b)

Runs the seed `prepare-for-exit` workflow's read-only session-exit verifier ([GAP-314 §5]($JV_REPO/docs/gap-specs/GAP-314-operational-workflow-layer-design.md)) — 7 report-only checks. Capture output verbatim. Check 6 may still phrase "CURRENT-HANDOFF.md committed"; under fragments-only the durable artifact is the two exact fragment files. A draft checkpoint PR is not yet on `origin/test`, so report that warning accurately. The owning `prepare-for-exit.js` wording still needs to describe fragment publication.

```bash
node "$JV_ROOT/scripts/prepare-for-exit.js"
```

Runs unconditionally, in both the default (5b published as a draft PR) and `--no-commit` paths. Check 6 may warn until the owner merges the fragments. Capture the full output verbatim; do not re-derive or re-implement its checks here. Exit code is always 0 (report-only, never blocks) — this step never changes the CHECKPOINT-READY verdict.

Step 6 surfaces this output as the PREPARE-FOR-EXIT section of the CHECKPOINT REPORT.

## Step 5c2 — Cleanup-session report (no `--fix`)

Run the registered `cleanup-session` workflow through the runner so safety classification applies ([GAP-314 §6]($JV_REPO/docs/gap-specs/GAP-314-operational-workflow-layer-design.md)). Default (no `--fix`) runs the report-first arm then `STOPPED-GATED` on the destructive arm. Capture output as **CLEANUP-SESSION** in the report. One-off destructive apply is `/cleanup --fix` (skill `revealui-cleanup`), never from checkpoint.

```bash
node "$JV_ROOT/scripts/workflow-run.js" cleanup-session
```

`STOPPED-GATED` is expected and does **not** change CHECKPOINT-READY. Do not pass `--fix` or `--yes` here.

## Step 5d — Archive the consumed snapshot + GC stale ones (GAP-317 lifecycle)

Now that Step 4 folded this session's snapshot into the rolling handoff, retire it so the active dir only ever holds live sessions' records (acceptance: none older than 7 days active). This is the agent-invoked mover. Agent-authored five-section files are still not hook-authored; PreCompact may have written a labeled `origin: precompact-mechanical` last-ditch file — archive that too.

```bash
ss_ensure_coord_dirs
SNAP_DIR="$(ss_snap_dir)"
ARCH="$(ss_snap_archive_dir)"
# GC: sweep any active-dir snapshot older than 7 days into archive/ (bounded active dir)
find "$SNAP_DIR" -maxdepth 1 -type f -name '*.md' -mtime +7 -exec mv {} "$ARCH/" \; -printf 'GC-archived stale snapshot: %f\n' 2>/dev/null || true
# Also GC legacy Claude adapter active dir (read-through path; do not leave orphans)
LEGACY_SNAP="$HOME/.claude/coordination/snapshots"
if [ -d "$LEGACY_SNAP" ]; then
  mkdir -p "$LEGACY_SNAP/archive"
  find "$LEGACY_SNAP" -maxdepth 1 -type f -name '*.md' -mtime +7 -exec mv {} "$LEGACY_SNAP/archive/" \; -printf 'GC-archived legacy snapshot: %f\n' 2>/dev/null || true
fi
# Archive THIS session's consumed snapshot wherever it lived (neutral first)
if [ -n "$SID" ]; then
  for p in "$SNAP_DIR/$SID.md" "$LEGACY_SNAP/$SID.md"; do
    if [ -f "$p" ]; then
      dest_arch="$ARCH"
      case "$p" in
        "$LEGACY_SNAP"/*) dest_arch="$LEGACY_SNAP/archive"; mkdir -p "$dest_arch" ;;
      esac
      mv "$p" "$dest_arch/" && echo "archived consumed snapshot: $p → $dest_arch/"
    fi
  done
fi
```

Under `--no-commit`: run the GC lines but **skip** the `$SID.md` move (the handoff edit was not committed, so the snapshot must stay active as the fidelity source until a real checkpoint captures it). If Step 1b found no snapshot for this session, the `$SID.md` lines are a no-op — nothing to archive.

## Step 6 — Report

Print this structured summary to the user (NOT just the assistant log — actual user-facing report):

```
=== CHECKPOINT REPORT — <ISO_DATETIME> ===

Handoff fragment:     <path under docs/handoffs/rolling/>
Workboard fragment:   <path under .revealui/workboard.d/>
Derived render:       local only (CURRENT-HANDOFF + workboard re-rendered; not committed)
Worktree:             <path from Step 5b; cleanup after PR disposition>
Commit:               <draft PR URL on exact branch | --no-commit: isolated worktree left for owner>

TRACKING SURFACES (6)
  [PASS|FAIL]  doc-locations-check.ts
  [PASS|WARN]  workboard-check.js
  [FRESH|...]  master-handoff-staleness.js
  [PASS|FAIL]  lanes-check.js
  [PASS|FAIL]  m1-adr-tracking-check.ts
  [PASS|FAIL]  m1-frontmatter-staleness-check.ts

INVENTORY
  active branches (branches.json):    <N>
  open PRs across fleet:              <N>
  active lanes:                       <N>
  uncommitted .jv changes:            <N files>

HOTFIXES → DURABLE (GAP-405, read-only; prefer durable fixes)
  [NONE|N pending]  revealui-harnesses hotfix check
  <for each pending: id — title — durable one-liner — resolve command>

PREPARE-FOR-EXIT (7, read-only, report-only)
  [PASS|WARN]  1. Fleet repo checkouts (main checkout) clean
  [PASS|WARN]  2. No worktree created this session remains
  [PASS|WARN]  3. No unpushed commits on any branch
  [PASS|WARN]  4. Registered temp scripts confirmed or surfaced
  [PASS|WARN]  5. Memory files created this session are indexed in MEMORY.md
  [PASS|WARN]  6. Handoff/workboard **fragments** committed and pushed (derived render optional/local)
  [PASS|WARN]  7. Scratchpad files that look like owner-run helpers are flagged
  <under each WARN, the verifier's own remediation line>

CLEANUP-SESSION (workflow cleanup-session, no --fix)
  [REPORT|STOPPED-GATED]  capture runner lines; STOPPED-GATED is expected
  <SAFE-TO-REMOVE / PR-OPEN / UNKNOWN worktree labels; do not remove from checkpoint>

OUTSTANDING (action by owner or next agent)
  - <enumerate each FAIL item with suggested fix>
  - <enumerate uncommitted/unpushed work>
  - <enumerate owner-gated items>
  - <enumerate each PREPARE-FOR-EXIT WARN with its remediation line>
  - <enumerate each pending hotfix id + durable target (from Step 3f); never omit>
  - <if Step 2c is STALE or EXPIRED: `/rollup` (do not auto-run)>
  - <cleanup residue the user must apply: `/cleanup --fix` — never implied>

CHECKPOINT-READY: <YES | NO — see outstanding>
```

**CHECKPOINT-READY rules:**
- `YES` only when: all 6 validators PASS (or only `master-handoff-staleness` is STALE which is non-blocking) AND uncommitted .jv changes are zero (or explicitly peer-WIP untracked files only) AND every open PR for the active branches is either GREEN-AND-MERGEABLE or owner-gated.
- `NO` otherwise. Finish agent-doable outstanding items in-session, then re-run the verdict; only owner-gated leftovers keep READY=NO.
- PREPARE-FOR-EXIT WARNs do NOT gate CHECKPOINT-READY — the verifier is report-only by design (it can never fail, per `prepare-for-exit.js`'s own contract). List its WARNs under OUTSTANDING for visibility; do not flip YES to NO on their account alone.
- CLEANUP-SESSION `STOPPED-GATED` does NOT gate CHECKPOINT-READY. List SAFE-TO-REMOVE items under OUTSTANDING; do not `--fix` from this skill.

## Step 7 — Optionally notify daemon

If the RPC daemon is up (`ss_daemon_alive`) and `nc` is installed, post a `checkpoint` event (advisory — not required):
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
  PAYLOAD="$(jq -cn --arg file "$CURRENT_HANDOFF" --arg from "$IDENTITY" \
    '{type:"checkpoint", file:$file, from:$from}')"
  if printf '%s\n' "$PAYLOAD" | nc -U -w 1 "$DAEMON_SOCKET" >/dev/null 2>&1; then
    DAEMON_NOTIFIED="yes"
  else
    DAEMON_NOTIFY_REASON="nc-write-failed"
  fi
fi
```

Daemon notification is non-blocking. The isolated `$CURRENT_HANDOFF` is the
current render while the PR is open; the shared `.jv` render may be stale until
the fragments merge and a later render refreshes it. SessionStart's `[menu]
CURRENT-HANDOFF` pointer is orientation only; it does not prove those draft
fragments are present. Consume is `/pickup` plus live PR verification.

## Step 8 — Next session consume path (prompt LAST)

**Primary:** new equal-adapter session, owner types `/pickup` (skill `revealui-pickup`). Give it `$CURRENT_HANDOFF` and the draft `$PR_URL` from Step 5b so it can read this checkpoint's isolated render and re-verify the PR with `gh`. Under `--no-commit`, give it `$WT` and both fragment paths instead of a PR URL. Do not auto-run `/pickup` on SessionStart.

**Fallback** (skill missing, other adapter, chat closed): emit a copy-pasteable next-agent prompt. Archive-Readiness still requires the fenced block as the last output of this turn.

Per fleet coordination rules: the fallback prompt must be droppable into a new session with no synthesis. Compose it with these 5 sections (in order):

1. **First line** — `New session: /pickup. Session <session-id> read-first: <absolute $CURRENT_HANDOFF>; draft PR: <PR_URL>`. Under `--no-commit`, replace the PR URL with `$WT` and the two fragment paths. The isolated render is the read-first file on this machine; the PR URL is the cross-machine recovery pointer.
2. **TL;DR** — 1–2 sentences with the single most important next action. Mirror CURRENT-HANDOFF **## Launch** row 1 (exact `rfg`/`rfc` command). Do not re-summarize.
3. **Ordered next-actions** — numbered list. Item 1 is that Launch command. Further items are the fragment's **Owner-gated** one-liners only (merge, deploy, promote, vault). Do not write a second plan. No "investigate X" / "decide Y". If the next-agent has to fill in `<paste prod URL here>` or guess a product, the convention has been violated.
4. **Locked-posture reminder** — one line. HARDLINES: `core.fileMode=false` on every .jv commit; stage the **two exact fragment files** only, never derived CURRENT-HANDOFF/workboard; `-F "$CMSG"`; `--body-file`; `--head`/`--base` explicit; `gh pr merge --merge` only on revealui-jv (label `merge:merge-commit`); no `--auto`/`--no-verify`/`--admin`/`--force-push`/`--squash`; audit-first; no authored regex; revvault-first secrets; durable-only.
5. **Owner-gated deferrals** — one short list of items the next agent must NOT auto-pick up without explicit owner sign-off.

Emit the prompt wrapped in a single triple-backtick fenced code block. The block must be the LAST thing emitted in the turn — no commentary, no "and that's it" trailer, nothing.

If the Step 6 verdict is `CHECKPOINT-READY: NO`, the TL;DR must lead with `BLOCKED: <reason>. Resolve before next session.` and the NEXT ACTIONS list must enumerate the blockers (failed validators, uncommitted state, open PRs without owner-gate clearance) as items to clear first.

If the session was a no-op (nothing shipped, no in-flight work), still emit the prompt — TL;DR reads `SESSION END — no follow-up required. Next agent starts fresh.` and NEXT ACTIONS list is empty (the section header still appears for symmetry).

The Step 4 fragment may include the next-agent instructions in its optional
§"Next-agent prompt" section. The PR URL exists only after Step 5b, so include
it in the final chat prompt and report, not by amending the committed fragment.
Another machine can fetch that draft PR and render its fragments. Under
`--no-commit`, recovery remains local to the retained worktree until the
owner publishes it.

## Do not

- Do NOT emit ANY text or tool call after Step 8's fenced prompt block. The block is the last thing in the turn — the owner triple-clicks to select.
- Do NOT auto-commit on the MAIN `.jv` checkout — committing there strands it on a `chore/checkpoint-*` branch (the 8-session divergence bug). Commit ONLY via Step 5b's isolated worktree, or pass `--no-commit` to defer to the owner. Still NEVER auto-merge with `--admin` or squash.
- Do NOT commit `docs/handoffs/CURRENT-HANDOFF.md`, `.revealui/workboard.md`, or `.claude/workboard.md` in a session checkpoint PR (derived renders; ADR 2026-07-23). Commit fragments only (`.revealui/workboard.d`). Do NOT treat `.claude/workboard.md` or `~/.claude/rules/` as the policy home.
- Do NOT run `master-handoff-regen.js` from this skill — one-off `/rollup` (workflow `master-handoff-regen`) only, when Step 2c is STALE/EXPIRED or the owner asked.
- Do NOT pass `--fix`/`--yes` to `cleanup-session` from this skill — report only; one-off `/cleanup --fix` is explicit.
- Do NOT create dated standalone handoff files (`docs/HANDOFF-YYYY-MM-DD-*.md`) — the rolling CURRENT-HANDOFF.md is the target. Do NOT write to `$JV_REPO/.claude/handoffs/` (non-canonical, retired 2026-05-19).
- Do NOT write to `/tmp/agent-handoff-*.md` (orphaned by design).
- Do NOT move or delete handoff files — the 7-day sweep handles dated files; the CURRENT-HANDOFF.md prune (Step 4b) handles the rolling file.
- Do NOT modify lane plans or MASTER_PLAN.md — validators here are READ-ONLY against body content.
- Do NOT reference tmux, tmux windows, panes, or `TMUX_PANE` — Studio-native.
- Do NOT attempt to spawn a new agent process — the user (or Studio UI) controls session creation.

## When to invoke

- End of a meaningful session (something shipped that needs handoff).
- Before a planned absence (owner stepping away mid-flight).
- When the user types `/checkpoint`, `/checkpoint <topic>`, or the Stop hook decides to run a final check.
- NOT for one-off questions, read-only sessions, or aborted starts.

**Arguments:** `/checkpoint --no-commit` writes two untracked fragments in an isolated worktree and leaves that worktree for owner review. The default (no flag) commits those two paths and opens a draft PR against `.jv` `test` per Step 5b (merge-commit disposition; label `merge:merge-commit`).

## Relationship to /handoff

`/handoff` is the predecessor — writes a basic handoff doc to the (now non-canonical) `.claude/handoffs/` location with no tracking-surface validation. `/checkpoint` supersedes it: rolling **fragments** + local CURRENT-HANDOFF render + 6 validators + inventory + structured report. **Consume** is `/pickup`, not `/next`. Recommend the slash command symlink at `~/.claude/commands/handoff.md` be retargeted to this skill in a follow-up (separate revskills PR).

## Related ADRs / gaps (.jv)

- `docs/decisions/2026-07-23-jv-coordination-merge-model.md` — fragments-only PRs; concurrent land-as-ready
- `docs/decisions/2026-07-23-jv-merge-commit-only.md` — merge-commit policy + label
- `docs/decisions/2026-07-21-current-handoff-rolling-fragments.md` — rolling fragments (amended)
- `docs/decisions/2026-07-04-workboard-fragment-store.md` — workboard.d fragments
- `docs/decisions/2026-08-26-session-launch-record.md` — `## Launch` / rfg product id
- `docs/gap-specs/GAP-469-revskills-vendor-agnostic-design.md` — neutral session + coordination root
- `docs/gaps/GAP-469.yml` — session contract execution unit
- `docs/gaps/GAP-494.yml` — `/coordinate` live peer packet (snapshot report / checkpoint refresh)
