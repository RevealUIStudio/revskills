---
name: revealui-checkpoint
description: Checkpoint checklist for RevFleet sessions. Validates the 6 coherent-tracking surfaces, inventories tracking state, writes a rolling handoff fragment + workboard log fragment, re-renders CURRENT-HANDOFF/workboard locally for read convenience, and commits ONLY append-only fragments (docs/handoffs/rolling + .claude/workboard.d) per ADR 2026-07-23-jv-coordination-merge-model. Worktree-gated when a peer is live. Never commits derived CURRENT-HANDOFF.md or workboard.md. Never master-handoff regen or auto-merge with --admin.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.14.0"
  website: https://revealui.com
---

Checkpoint orchestrator. Run before ending a meaningful session to ensure the next agent can pick up cleanly. Wires together the 6 coherent-tracking validators + 4 inventory surfaces + writes a **rolling handoff fragment** (`docs/handoffs/rolling/`) + a workboard log fragment (`.claude/workboard.d/`), **renders** `$JV_REPO/docs/handoffs/CURRENT-HANDOFF.md` and `workboard.md` **locally only** (read convenience), and **commits only append-only fragment paths** (ADR `2026-07-23-jv-coordination-merge-model` / jv#601). Concurrent sessions must not stack: unique fragment filenames merge without rewriting shared derived files. Then reports CHECKPOINT-READY + emits the archive-readiness next-agent prompt.

Authority on locations + tiers: [`master-handoff.md`]($JV_REPO/.claude/rules/master-handoff.md) (active at `docs/HANDOFF-*.md` root; archive at `docs/handoffs/archive/`). Authority on doc-location enforcement: [`jv-doc-locations.md`]($JV_REPO/.claude/rules/jv-doc-locations.md).

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Resolve context

```bash
IDENTITY="$(ss_identity)"
REPO="$(ss_active_repo)"
JV_ROOT="$JV_REPO"
WORKBOARD="$JV_ROOT/.claude/workboard.md"
ISO_DATE="$(date -u +%Y-%m-%d)"
ISO_DATETIME="$(date -u +%Y-%m-%dT%H:%MZ)"
# Rolling handoff — always merged into this one file.
CURRENT_HANDOFF="$JV_ROOT/docs/handoffs/CURRENT-HANDOFF.md"
```

Rolling handoff **read surface** per `~/.claude/rules/model-allocation.md` §Session handoff loop: `$JV_REPO/docs/handoffs/CURRENT-HANDOFF.md` (rendered). **Durable write surface:** `docs/handoffs/rolling/<ISO>-<id>.md` only. Every session adds a fragment rather than creating a dated handoff file. Renderer caps history (`--max`, default 12); optional `--gc` archives rolling fragments older than 7d (Step 4b).

## Step 1b — Load the auto-checkpoint snapshot (fidelity source)

A session snapshot is captured **before context compaction** by the `/snapshot` skill (Grok Stop-gate at the occupancy gate; Claude `[snapshot]` advisory; PreCompact mechanical last-ditch). When one exists it is the PRIMARY source for the narrative sections in Step 4 — more trustworthy than reconstructing from now-deep or already-compacted session memory.

Resolve it by **this session's id, never by mtime** — a peer's snapshot must be structurally unreachable (GAP-317 + GAP-469). Session id and paths come from `session-state.sh` (neutral SSOT under `~/.local/share/revealui/coordination/`, with read-through of the legacy Claude adapter path).

**Load order (GAP-342 residual):** prefer the filesystem SSOT when present; if the file is missing, best-effort hydrate from daemon `session.snapshot.get` by the same id into the neutral write path (`ss_snapshot_load_path`). Never mtime, never another session's file.

```bash
SID="$(ss_session_id 2>/dev/null || true)"
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
  echo "no snapshot for this session (${SID:-no-session-id}) — Step 4 falls back to session memory"
fi
```

If `$SNAPSHOT` is set it is unambiguously THIS session's (the filename equals the resolved session id), so no content-matching guesswork is needed. READ it and use its five sections (Resume-From-Here, What-Shipped, Active-Constraints, Do-Not-Repeat, Open-Loose-Ends) as the spine of the Step 4 merge; they map onto the rolling file's sections. If frontmatter has `origin: precompact-mechanical`, say so in the fragment (lower fidelity; compaction fired before agent authoring). With no snapshot — occupancy never hit the gate, or `/snapshot` was not run, or no session id is set — Step 4 proceeds from session memory as before. Do **not** abort solely because `CLAUDE_CODE_SESSION_ID` is unset when another alias is present. Do NOT fall back to the most-recent file on disk; an unmatched id means no snapshot for this session.

## Step 2 — Run coherent-tracking validators

Capture pass/fail per check. Do NOT auto-fix anything destructive.

### 2a. Doc locations
```bash
cd "$JV_ROOT" && ~/revfleet/revealui/node_modules/.bin/tsx scripts/doc-locations-check.ts --quiet
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
Recomputes `staleness-status` (FRESH / STALE / EXPIRED) in `docs/MASTER_HANDOFF.md` frontmatter. Read-only against body.

### 2d. Lane plans
```bash
node "$JV_ROOT/scripts/lanes-check.js"
```
Validates each lane's frontmatter + plan.md presence.

### 2e. M-1 ADR tracking-issue compliance
```bash
~/revfleet/revealui/node_modules/.bin/tsx "$JV_ROOT/scripts/m1-adr-tracking-check.ts" --base-ref=origin/main --head-ref=HEAD --mode=ci
```
Every ADR (post-2026-05-16 cutoff) must carry `tracking-issue:` frontmatter. The check needs a diff range: `origin/main...HEAD` scopes it to ADRs on the current branch not yet on `main` (empty on a fresh `main` → exit 0). Invoking it with no range exits 2 with a usage error — that was the Step 2e bug, fixed 2026-06-06. Requires `origin/main` to be fetched (the inventory step already hits the network, so a stale ref is the only failure mode).

### 2f. M-1 frontmatter staleness
```bash
~/revfleet/revealui/node_modules/.bin/tsx "$JV_ROOT/scripts/m1-frontmatter-staleness-check.ts" --mode=ci
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

### 3b. Open PRs across RevFleet repos
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

## Step 4 — Write rolling handoff fragment + local render

**Contention-free path (2026-07-21, amended 2026-07-23):** do **not** hand-edit `$CURRENT_HANDOFF` when a peer may be live. Write a **new fragment** under `docs/handoffs/rolling/`, then render **locally** for the report/prompt. Sibling of workboard fragments (ADR 2026-07-04). **Do not commit the render** (ADR 2026-07-23-jv-coordination-merge-model; CI `Coord paths guard` fails PRs that edit `CURRENT-HANDOFF.md` / `workboard.md`).

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
printf '%s\n' "$HANDOFF_BODY" \
  | node "$JV_ROOT/scripts/handoff-fragment.js" --id "$IDENTITY"
# Local read convenience only — derived view, not a commit path:
node "$JV_ROOT/scripts/handoff-render.js"
# Optional GC of rolling fragments older than 7d:
# node "$JV_ROOT/scripts/handoff-render.js" --gc
```

Never create a dated `docs/HANDOFF-YYYY-MM-DD-*.md` for the rolling train. Prefer session-specific truth in the **fragment** (unique path). After peers land, `git fetch` + re-render so `$CURRENT_HANDOFF` reflects all fragments.

### 4b. Size control

Rolling history is capped by `handoff-render.js --max` (default 12 fragments). Older fragments age out with `--gc` (7-day mtime → `docs/handoffs/archive/rolling/`). Do not hand-prune GENERATED blocks.

## Step 5 — Workboard log entry

**Compose** this session's Log line (do NOT hand-edit `## Log` — the workboard `## Log` block is now GENERATED from per-session fragments per ADR `2026-07-04-workboard-fragment-store`, the contention-free write path):
```
- [YYYY-MM-DD HH:MM] <IDENTITY>: [CHECKPOINT] → rolling fragment only | tracking: <X pass / Y fail> | next: <one-line next action from §Ordered next actions>
```

Step 5b writes it as a **fragment** (`.claude/workboard.d/log/<ts>-<id>.md` — a new per-session file that can never collide with a peer) and re-renders `workboard.md` **locally only**, in the correct checkout (main for SOLO, the worktree for PEER). Set the volatile parts **as single-quoted literals** so a next-action containing backticks / `$(…)` / quotes is never command-substituted (`§Ordered next actions` holds exact commands + paths, which routinely use backticks):
```bash
TS="$(date -u '+%Y-%m-%d %H:%M')"
TRACK='<X pass / Y fail>'
NEXT='<one-line next action from §Ordered next actions>'   # single-quoted literal; a literal ' inside → close+reopen: '\''
```
Step 5b assembles the line with `printf %s` (never re-evaluates) and pipes it to `workboard-fragment.js` on stdin. Because the log line is a fresh file (never an edit to the shared `workboard.md`), it sidesteps both the `rogue-workboard` hook and the dirty-file guard, so this step can never strand the checkout.

## Step 5b — Commit + converge the .jv delta (worktree-gated; **fragments only**)

DEFAULT: commit **append-only fragment paths only** and converge them to `origin/test`:

- `docs/handoffs/rolling/**`
- `.claude/workboard.d/**`

**Never stage** `docs/handoffs/CURRENT-HANDOFF.md` or `.claude/workboard.md` in a session checkpoint PR (derived renders; concurrent rewrites always conflict). CI **Coord paths guard** on `revealui-jv` fails those paths unless labeled `coord:allow-render-commit` (escape hatch only).

Local render in Steps 4–5 remains required so the CHECKPOINT REPORT and next-agent prompt can read a fresh board; after `git fetch origin test`, re-run `handoff-render.js` / `workboard-sweep.js --render-only` to refresh derived views.

Pass `--no-commit` to skip Step 5b and leave fragment writes UNSTAGED for owner review — then jump to Step 6 and list them under OUTSTANDING.

**CRITICAL — never strand the main checkout.** A naive commit on the MAIN `.jv` checkout was the root cause of the 8-session checkpoint-merge divergence: it left the main checkout on a `chore/checkpoint-*` branch that later merged+deleted, so every subsequent checkpoint merged onto the dead branch and never converged. The fix is the `.jv` Single-Writer Discipline — when a peer is live, do the commit from a throwaway `$JV_REPO-wt/` worktree so the main checkout never moves.

Determine the writer mode (count live interactive equal-harness sessions — Claude, Grok, Cursor agent, OpenCode — GAP-469):
```bash
PEERS="$(node "$JV_ROOT/scripts/jv-single-writer-check.js" --count 2>/dev/null \
  || ss_live_harness_peers)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CMSG="/tmp/cmsg-ckpt-${STAMP}.txt"   # write the commit message here (Step 5b uses -F)
```
If `jv-single-writer-check.js` has no `--count` mode yet, `ss_live_harness_peers` is authoritative (not `pgrep claude` alone).

Throughout: `core.fileMode=false` on every `.jv` commit; **explicit pathspec (fragments only)**
`-- docs/handoffs/rolling .claude/workboard.d`
(NEVER stage `CURRENT-HANDOFF.md`, `workboard.md`, `tmp/`, or peer-WIP untracked);
`-F "$CMSG"`; `--body-file` PR bodies; `--head`/`--base` explicit;
**merge-COMMIT only, never squash** on `.jv` protecteds (repo squash disabled + label
`merge:merge-commit` required by CI); add that label on the checkpoint PR;
NO `--admin`/`--no-verify`/`--force-push`.

**SOLO (`PEERS` ≤ 1)** — commit on the current `.jv` branch (fragments pathspec only):
```bash
cd "$JV_ROOT"
BR="chore/checkpoint-${ISO_DATE}-${IDENTITY}"
# Step 4 already wrote handoff rolling fragment + local render. Workboard log:
printf -- '- [%s] %s: [CHECKPOINT] → rolling fragment only | tracking: %s | next: %s\n' "$TS" "$IDENTITY" "$TRACK" "$NEXT" \
  | node "$JV_ROOT/scripts/workboard-fragment.js" --kind log --id "$IDENTITY"
node "$JV_ROOT/scripts/workboard-sweep.js" --render-only
# Fragments only — do not add CURRENT-HANDOFF.md or workboard.md
git add docs/handoffs/rolling .claude/workboard.d
git -c core.fileMode=false commit -F "$CMSG" -- \
  docs/handoffs/rolling .claude/workboard.d
git push origin "HEAD:refs/heads/$BR"
gh pr create --base test --head "$BR" --body-file "$CMSG"
gh pr edit <n> --repo RevealUIStudio/revealui-jv --add-label "merge:merge-commit"
# Stop here unless the owner named an in-session merge disposition.
# Owner merge (merge-commit only; never squash):
#   gh pr merge <n> --repo RevealUIStudio/revealui-jv --merge --delete-branch
git fetch origin test && git merge --ff-only origin/test 2>/dev/null || true
node "$JV_ROOT/scripts/handoff-render.js"   # refresh local derived view after land
```

**PEER LIVE (`PEERS` > 1)** — do NOT commit on the main checkout; use a dedicated worktree:
```bash
cd "$JV_ROOT"
WT="$JV_REPO-wt/ckpt-${ISO_DATE}-$$"; BR="chore/checkpoint-${ISO_DATE}-${IDENTITY}"
# Prefer fragment-only dirty state (rolling/ + workboard.d). If CURRENT-HANDOFF.md
# is dirty from a local render, leave it unstaged (or restore) — never commit it.
git fetch origin test && git merge --ff-only origin/test
git worktree add "$WT" -b "$BR" origin/test
cd "$WT"
# Re-write this session's fragments INTO the worktree:
printf '%s\n' "$HANDOFF_BODY" \
  | node "$JV_ROOT/scripts/handoff-fragment.js" --id "$IDENTITY" --base "$WT/docs/handoffs/rolling"
node "$JV_ROOT/scripts/handoff-render.js" --base "$WT/docs/handoffs/rolling" --out "$WT/docs/handoffs/CURRENT-HANDOFF.md"
printf -- '- [%s] %s: [CHECKPOINT] → rolling fragment only | tracking: %s | next: %s\n' "$TS" "$IDENTITY" "$TRACK" "$NEXT" \
  | node "$JV_ROOT/scripts/workboard-fragment.js" --kind log --id "$IDENTITY" --base "$WT/.claude/workboard.d"
node "$JV_ROOT/scripts/workboard-sweep.js" --render-only --workboard "$WT/.claude/workboard.md" --base "$WT/.claude/workboard.d"
# Fragments only
git add docs/handoffs/rolling .claude/workboard.d
git -c core.fileMode=false commit -F "$CMSG" -- \
  docs/handoffs/rolling .claude/workboard.d
git push origin "HEAD:refs/heads/$BR"
gh pr create --base test --head "$BR" --body-file "$CMSG"
gh pr edit <n> --repo RevealUIStudio/revealui-jv --add-label "merge:merge-commit"
# Owner disposes merge (do not self-merge without named in-session auth):
#   gh pr merge <n> --repo RevealUIStudio/revealui-jv --merge --delete-branch
cd "$JV_ROOT" && git worktree remove "$WT" 2>/dev/null || true
git fetch origin test && git merge --ff-only origin/test 2>/dev/null || true
node "$JV_ROOT/scripts/handoff-render.js"
```

**Cleanup + failure handling.** On success the temp worktree is removed. Branch delete rides the owner merge (`--delete-branch`). On ANY failure — the initial converge is not a clean fast-forward, an unresolved `stash pop` conflict, or a push/merge error — DO NOT silently drop the delta: surface the stash ref (`git stash list`) or the worktree path, fall back to the `--no-commit` end state (writes left for the owner), and leave the main checkout on its original branch. Never leave the main checkout on a `chore/checkpoint-*` branch.

## Step 5c — Prepare-for-exit verifier (read-only, runs after 5b converges)

Runs the seed `prepare-for-exit` workflow's read-only session-exit verifier ([GAP-314 §5]($JV_REPO/docs/gap-specs/GAP-314-operational-workflow-layer-design.md)) — 7 report-only checks. Capture output verbatim. Check 6 may still phrase "CURRENT-HANDOFF.md committed"; under fragments-only the durable artifact is `docs/handoffs/rolling/**` (and workboard.d). Treat check 6 as **PASS** when the rolling fragment is on `origin/test` even if the derived render was not committed. Optional follow-up: update `prepare-for-exit.js` wording to "handoff fragments committed".

```bash
node "$JV_ROOT/scripts/prepare-for-exit.js"
```

Runs unconditionally, in both the default (5b committed) and `--no-commit` paths — under `--no-commit` its check 6 (handoff committed + pushed) is expected to WARN, which is informative, not a bug. Capture the full output verbatim; do not re-derive or re-implement its checks here. Exit code is always 0 (report-only, never blocks) — this step never changes the CHECKPOINT-READY verdict.

Step 6 surfaces this output as the PREPARE-FOR-EXIT section of the CHECKPOINT REPORT.

## Step 5d — Archive the consumed snapshot + GC stale ones (GAP-317 lifecycle)

Now that Step 4 folded this session's snapshot into the rolling handoff, retire it so the active dir only ever holds live sessions' records (acceptance: none older than 7 days active). This is the agent-invoked mover. Agent-authored five-section files are still not hook-authored; PreCompact may have written a labeled `origin: precompact-mechanical` last-ditch file — archive that too.

```bash
ss_ensure_coord_dirs
SNAP_DIR="$(ss_snap_dir)"
ARCH="$(ss_snap_archive_dir)"
SID="$(ss_session_id 2>/dev/null || true)"
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
Workboard fragment:   <path under .claude/workboard.d/>
Derived render:       local only (CURRENT-HANDOFF + workboard re-rendered; not committed)
Commit:               <#N merged to .jv test | committed locally <branch> | --no-commit: left unstaged for owner>

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

OUTSTANDING (action by owner or next agent)
  - <enumerate each FAIL item with suggested fix>
  - <enumerate uncommitted/unpushed work>
  - <enumerate owner-gated items>
  - <enumerate each PREPARE-FOR-EXIT WARN with its remediation line>
  - <enumerate each pending hotfix id + durable target (from Step 3f); never omit>

CHECKPOINT-READY: <YES | NO — see outstanding>
```

**CHECKPOINT-READY rules:**
- `YES` only when: all 6 validators PASS (or only `master-handoff-staleness` is STALE which is non-blocking) AND uncommitted .jv changes are zero (or explicitly peer-WIP untracked files only) AND every open PR for the active branches is either GREEN-AND-MERGEABLE or owner-gated.
- `NO` otherwise. Owner must address outstanding items before letting the session close.
- PREPARE-FOR-EXIT WARNs do NOT gate CHECKPOINT-READY — the verifier is report-only by design (it can never fail, per `prepare-for-exit.js`'s own contract). List its WARNs under OUTSTANDING for visibility; do not flip YES to NO on their account alone.

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

Daemon notification is non-blocking. If it fails for any reason, the handoff is still valid: next session's SessionStart hook discovers it via filesystem — `session-start.js` prints the `[menu] CURRENT-HANDOFF §Ordered next actions` pointer whenever the rolling handoff exists, which is the next-session orientation surface. (The former Step 7.5 invoked a `session-note` skill that was never built; removed in 0.6.1.)

## Step 8 — Emit copy-pasteable next-agent prompt (LAST output — nothing after this)

Per fleet coordination rules (Archive-Readiness Convention): the final output of any checkpoint flow MUST be a copy-pasteable "next-agent prompt" the owner can drop straight into a **new equal-adapter session** (Claude, Grok, Cursor, …) — no synthesis required, no jumping between docs. **The prompt is non-negotiable.** Without it, the owner has to do friction work (read CURRENT-HANDOFF.md + workboard + memories + figure out the first action) every multi-session handoff. That friction compounds across the fleet.

Compose the prompt with these 5 sections (in order):

1. **First line** — `Session <session-id> — read first: $JV_REPO/docs/handoffs/CURRENT-HANDOFF.md`. The path is the absolute filesystem path to the rolling handoff file.
2. **TL;DR** — 1–2 sentences with the single most important next action. Mirror CURRENT-HANDOFF **## Launch** row 1 (exact `rfg`/`rfc` command). Do not re-summarize.
3. **Ordered next-actions** — numbered list. Item 1 is that Launch command. Further items are EXACT commands / paths. No "investigate X" / "decide Y". If the next-agent has to fill in `<paste prod URL here>` or guess a product, the convention has been violated.
4. **Locked-posture reminder** — one line. HARDLINES: `core.fileMode=false` on every .jv commit; **fragments-only pathspec** (`rolling` + `workboard.d`, never derived CURRENT-HANDOFF/workboard); `-F /tmp/cmsg-*.txt`; `--body-file`; `--head`/`--base` explicit; `gh pr merge --merge` only on revealui-jv (label `merge:merge-commit`); no `--auto`/`--no-verify`/`--admin`/`--force-push`/`--squash`; audit-first; no authored regex; revvault-first secrets; durable-only.
5. **Owner-gated deferrals** — one short list of items the next agent must NOT auto-pick up without explicit owner sign-off.

Emit the prompt wrapped in a single triple-backtick fenced code block. The block must be the LAST thing emitted in the turn — no commentary, no "and that's it" trailer, nothing.

If the Step 6 verdict is `CHECKPOINT-READY: NO`, the TL;DR must lead with `BLOCKED: <reason>. Resolve before next session.` and the NEXT ACTIONS list must enumerate the blockers (failed validators, uncommitted state, open PRs without owner-gate clearance) as items to clear first.

If the session was a no-op (nothing shipped, no in-flight work), still emit the prompt — TL;DR reads `SESSION END — no follow-up required. Next agent starts fresh.` and NEXT ACTIONS list is empty (the section header still appears for symmetry).

The same content should be in CURRENT-HANDOFF.md §"Next-agent prompt" (optional Step 4 section). The chat emission is for immediate copy-paste; CURRENT-HANDOFF.md is for recovery if chat closes before paste.

## Do not

- Do NOT emit ANY text or tool call after Step 8's fenced prompt block. The block is the last thing in the turn — the owner triple-clicks to select.
- Do NOT auto-commit on the MAIN `.jv` checkout — committing there strands it on a `chore/checkpoint-*` branch (the 8-session divergence bug). Commit ONLY via Step 5b (worktree-gated when a peer is live), or pass `--no-commit` to defer to the owner. Still NEVER auto-merge with `--admin` or squash.
- Do NOT commit `docs/handoffs/CURRENT-HANDOFF.md` or `.claude/workboard.md` in a session checkpoint PR (derived renders; ADR 2026-07-23). Commit fragments only.
- Do NOT run `master-handoff-regen.js` — that's a separate audited operation (agent-invoked, owner-attended, expensive).
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

**Arguments:** `/checkpoint --no-commit` skips Step 5b and leaves **fragment** writes UNSTAGED for the owner to review/commit — use it when the handoff needs an eyeball before it lands. The default (no flag) commits + converges **fragments only** to `.jv` `test` per Step 5b (merge-commit; label `merge:merge-commit`).

## Relationship to /handoff

`/handoff` is the predecessor — writes a basic handoff doc to the (now non-canonical) `.claude/handoffs/` location with no tracking-surface validation. `/checkpoint` supersedes it: rolling **fragments** + local CURRENT-HANDOFF render + 6 validators + inventory + structured report. Recommend the slash command symlink at `~/.claude/commands/handoff.md` be retargeted to this skill in a follow-up (separate revskills PR).

## Related ADRs / gaps (.jv)

- `docs/decisions/2026-07-23-jv-coordination-merge-model.md` — fragments-only PRs; concurrent land-as-ready
- `docs/decisions/2026-07-23-jv-merge-commit-only.md` — merge-commit policy + label
- `docs/decisions/2026-07-21-current-handoff-rolling-fragments.md` — rolling fragments (amended)
- `docs/decisions/2026-07-04-workboard-fragment-store.md` — workboard.d fragments
- `docs/decisions/2026-08-26-session-launch-record.md` — `## Launch` / rfg product id
- `docs/gap-specs/GAP-469-revskills-vendor-agnostic-design.md` — neutral session + coordination root
- `docs/gaps/GAP-469.yml` — session contract execution unit
