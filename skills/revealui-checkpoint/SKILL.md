---
name: revealui-checkpoint
description: Preserve scoped session work across repositories, verify commits and publication, and save a session-specific rolling handoff and neutral workboard fragments. Use for checkpoint, save-work, or handoff requests; keep preservation separate from review, merge, and fleet health.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.17.0"
  website: https://revealui.com
---

Preserve the user's requested work and enough verified context to resume it. Source
commits remain in their owning repositories; this skill records their exact heads,
validation and publication in the existing rolling-handoff/workboard fragment store.
A saved checkpoint can contain open PRs, controller dependencies or known blockers.
It does not grant merge authority or require unrelated peer work to be clean.

## Scope and preservation contract

Before writing, enumerate the repositories and worktrees belonging to this task.
For each, record the canonical live repository name, worktree path, branch, exact
HEAD, session-owned pending paths, last verified remote head, PR URL/state, checks
and observation time. Resolve GitHub identity and default branch through the
repository's existing remote and live metadata; do not hardcode an organization
or rewrite local origins during a checkpoint. API failure means unknown, not green.

Commit authorized source changes in their owning feature branches with explicit
file paths and the repository's maintained validation and publication entrypoint.
Do not stage a whole dirty checkout, borrow a peer's staged files, stash peer work,
reset files or move a main checkout. A prose handoff is not a substitute for
uncommitted source. If ownership is unclear, retain the bytes and exact path and
record the unresolved ownership; do not guess or claim everything was committed.

Distinguish **LOCAL-SAVED**, **PUBLISHED**, **LANDED**, and **REVIEW-STATE** for every
repository. Verify publication at the exact commit, not only by command exit or an
ancestor relationship. Record controller admission separately. The intended review
authority is `revealui-review-controller`; while its migration remains shadow-only,
report the active gate as a dependency. A checkpoint never asks for a per-head owner
signature or applies an approval label to manufacture readiness.

Keep existing tracked audits as the detailed evidence authority and link them from
the handoff. Preserve earlier observations and append dated current evidence. Name
an independent peer's lane (including RFX sessions) and the dependency boundary;
continue complementary work without taking over their implementation or cleanup.

This skill is human/agent handoff. It is not `rfloop`. rfloop is a PR/CI operator disk state machine only (P0 stub; no LLM; auto-merge locked). It is not the fleet brain or the product AgentRuntime. Prefer `rfloop`; `revloop` is a rename shim.

Policy home is `$JV_REPO/.revealui` (manager and content) before any vendor tree. Read location and handoff tiers there first. Active handoffs stay at `docs/HANDOFF-*.md`; archive stays at `docs/handoffs/archive/`. `$JV_REPO/.claude/rules/master-handoff.md`, `$JV_REPO/.claude/rules/jv-doc-locations.md`, and `~/.claude/rules/` (including `model-allocation.md`) are Claude adapter attach copies, not the policy home. `$JV_REPO/.claude/workboard.md` is adapter render only.

Load helpers:
```bash
. "$REVEALFLEET_ROOT/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Resolve context

```bash
IDENTITY="$(ss_identity)"
SID="$(ss_session_id 2>/dev/null || true)"
REPO="$(ss_active_repo)"
ISO_DATE="$(date -u +%Y-%m-%d)"
ISO_DATETIME="$(date -u +%Y-%m-%dT%H:%MZ)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
# A missing id never permits another session's identity/snapshot.
CHECKPOINT_ID="${SID:-$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')}"
JV_SOURCE="$JV_REPO"
JV_SLUG="$(cd "$JV_SOURCE" && gh repo view --json nameWithOwner --jq .nameWithOwner)"
JV_DEFAULT_BRANCH="$(gh repo view "$JV_SLUG" --json defaultBranchRef --jq .defaultBranchRef.name)"
(cd "$JV_SOURCE" && git fetch origin "$JV_DEFAULT_BRANCH")
BR="chore/checkpoint-${STAMP}-${CHECKPOINT_ID}"
JV_ROOT="$REVEALFLEET_ROOT/.worktrees/checkpoint-${STAMP}-${CHECKPOINT_ID}"
(cd "$JV_SOURCE" && git worktree add "$JV_ROOT" -b "$BR" "origin/$JV_DEFAULT_BRANCH")
WORKBOARD_D="$JV_ROOT/.revealui/workboard.d"
WORKBOARD="$JV_ROOT/.revealui/workboard.md"
WORKBOARD_ADAPTER="$JV_ROOT/.claude/workboard.md"
CURRENT_HANDOFF="$JV_ROOT/docs/handoffs/CURRENT-HANDOFF.md"
```

Use the isolated writer for all fragments, validation and local renders, including
`--no-commit`. Never fast-forward or switch the shared main checkout. If remote
metadata/fetch fails, preserve source first and record the failed observation;
use a verified existing local `.jv` base only when its provenance is known and
report the resulting checkpoint as local. Keep the worktree and branch on failure.


Rolling handoff **read surface** (rendered): `$JV_REPO/docs/handoffs/CURRENT-HANDOFF.md`. **Durable write surface:** `docs/handoffs/rolling/<ISO>-<id>.md` only. `~/.claude/rules/model-allocation.md` may restate the handoff loop; that file is adapter attach, not policy. Every session adds a fragment rather than creating a dated handoff file. Renderer caps history (`--max`, default 12); garbage collection is a separate maintenance operation, outside this checkpoint. Workboard durable writes go to `$WORKBOARD_D` (`.revealui/workboard.d`). The neutral render is `$WORKBOARD` (`.revealui/workboard.md`). `$WORKBOARD_ADAPTER` (`.claude/workboard.md`) is adapter render only.

## Step 1b — Load the auto-checkpoint snapshot (fidelity source)

A session snapshot is captured **before context compaction** by the `/snapshot` skill (Grok Stop-gate at the occupancy gate; Claude `[snapshot]` advisory; PreCompact mechanical last-ditch). When one exists it is the PRIMARY source for the narrative sections in Step 4 — more trustworthy than reconstructing from now-deep or already-compacted session memory.

The gate tracks the control-layer token budget (`token-economy`, authored in `packages/harnesses/src/token-budget.ts`). RevKit writes that budget into `~/.grok/config.toml` (`compaction_at_tokens` and `auto_compact_threshold_percent`). The Stop gate fires `snapshotHeadroomTokens` before compact. A checkpoint whose snapshot says `origin: precompact-mechanical` means compact won the race; say so in the fragment.

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

Capture PASS, FAIL, WARN, UNAVAILABLE or NOT-APPLICABLE per check. Missing tools or private-planning access are explicit limitations, never PASS. Run applicable validators in the isolated coordination writer. They describe planning health; they do not erase or block preservation of committed source work.

### 2a. Doc locations
```bash
cd "$JV_ROOT" && "$REVEALUI_REPO/node_modules/.bin/tsx" scripts/doc-locations-check.ts --quiet
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
This checker can update frontmatter. Run it only in the isolated writer, never the shared main checkout. Its derived change is outside the checkpoint commit paths. If the result is STALE or EXPIRED, list `/rollup` under OUTSTANDING — do **not** run `master-handoff-regen` inside checkpoint (skill `revealui-rollup`).

### 2d. Lane plans
```bash
node "$JV_ROOT/scripts/lanes-check.js"
```
Validates each lane's frontmatter + plan.md presence.

### 2e. M-1 ADR tracking-issue compliance
```bash
TSX="$REVEALUI_REPO/node_modules/.bin/tsx"
BASE_REF="origin/$JV_DEFAULT_BRANCH"
(cd "$JV_ROOT" && git rev-parse --verify "$BASE_REF")
"$TSX" "$JV_ROOT/scripts/m1-adr-tracking-check.ts" --base-ref="$BASE_REF" --head-ref=HEAD --mode=ci
```
Every ADR (post-2026-05-16 cutoff) must carry `tracking-issue:` frontmatter. The check needs a diff range: `<default-branch>...HEAD` (empty range → exit 0). Invoking it with no range exits 2 with a usage error — that was the Step 2e bug, fixed 2026-06-06. Do not hardcode `origin/main` on repos whose GitHub default branch is `test`.

### 2f. M-1 frontmatter staleness
```bash
"$REVEALUI_REPO/node_modules/.bin/tsx" "$JV_ROOT/scripts/m1-frontmatter-staleness-check.ts" --mode=ci
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

### 3b. Scoped repository review state

Use the task repository ledger established above. Query each recorded canonical
repository and exact PR head; record check-run identities and superseded runs where
needed. Do not scan every fleet repo to decide whether this session is saved.
Unrelated open PRs and peer WIP belong in informational inventory, not this task's
preservation verdict. Controller-owned approval/cutover work is a dependency, not a
request to return to the retired signing flow.

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

### 3g. Peer lane evidence

Read the existing coordination roster and record the peer's task boundary in the
handoff. Do not refresh a claim or write an active fragment as an implicit checkpoint
side effect. If the session explicitly owns a live claim, use the existing coordinate
primitive separately within that claim's authorization and include its exact path in
preservation accounting.

## Step 4 — Write rolling handoff fragment + local render

**Contention-free path (2026-07-21, amended 2026-07-23):** do **not** hand-edit `$CURRENT_HANDOFF` when a peer may be live. Write a **new fragment** under `docs/handoffs/rolling/`, then render **locally** for the report/prompt. Sibling of workboard fragments (ADR 2026-07-04). **Do not commit the render** (ADR 2026-07-23-jv-coordination-merge-model; CI `Coord paths guard` fails PRs that edit `CURRENT-HANDOFF.md` / `workboard.md`).

Compose the delta PRIMARILY from the Step 1b snapshot when present, supplemented by session memory + Step 2-3 results. With no snapshot, fall back to session memory.

**Security content: CITE, don't restate (owner ruling 2026-07-16).** When the session touched security findings / exploits / confinement / crypto, the delta references the artifact only — never re-describes the technique. Applies to the fragment, the workboard log (Step 5), and the next-agent prompt (Step 8).

### 4a. Write the fragment

```bash
# Compose body with at least ## Last merge (renderer extracts it for the top block)
# Include the repository recovery ledger and exact resume command.
# Product sessions retain their established Launch record; integration lanes use
# their actual worktree/audit command rather than inventing a product identifier.
HANDOFF_BODY="$(cat <<'EOF'
## Last merge

<ISO_DATE> — <IDENTITY>: <≤15 words what landed>

## Launch

<task lane, independent peer boundary, exact resume command or read-first path>

Use the established product launch table for a product session. An integration
checkpoint keeps this heading for the renderer and records its actual worktree
resume command; it does not invent a product basename.

## Repository recovery ledger

| Repository / worktree | Branch / exact HEAD | Saved / published / landed | PR / review / validation |
|-----------------------|---------------------|----------------------------|--------------------------|
| <verified canonical identity and absolute worktree> | <branch and commit> | <each state independently> | <exact-head evidence and timestamp> |


## Live board

| Surface | State |
|---------|--------|
| … | re-verify with gh |

## In-flight

- …

## Ordered next actions

1. <exact command against the recorded worktree or read-first audit>

## Owner-gated

- …

## Pending hotfixes (if any from Step 3f)

- none | list id — title — durable target
EOF
)"
HANDOFF_FRAGMENT="$(printf '%s\n' "$HANDOFF_BODY" \
  | node "$JV_ROOT/scripts/handoff-fragment.js" --id "$CHECKPOINT_ID" \
      --base "$JV_ROOT/docs/handoffs/rolling")"
# Local read convenience only — derived view, not a commit path:
node "$JV_ROOT/scripts/handoff-render.js"
```

Never create a dated `docs/HANDOFF-YYYY-MM-DD-*.md` for the rolling train. Prefer session-specific truth in the **fragment** (unique path). After peers land, `git fetch` + re-render so `$CURRENT_HANDOFF` reflects all fragments.

### 4b. Retention

Render with the maintained renderer's default history cap. Preserve source branches,
worktrees, snapshots and fragments until their exact durable references have been
verified. Age alone does not prove a peer's work is safe to archive. Garbage
collection is outside this skill's checkpoint scope.

## Step 5 — Workboard log entry

**Compose** this session's Log line (do NOT hand-edit `## Log` — the workboard `## Log` block is now GENERATED from per-session fragments per ADR `2026-07-04-workboard-fragment-store`, the contention-free write path):
```
- [YYYY-MM-DD HH:MM] <IDENTITY>: [CHECKPOINT] → rolling fragment only | tracking: <X pass / Y fail> | next: <one-line next action from §Ordered next actions>
```

Step 5b writes it as a **fragment** (`.revealui/workboard.d/log/<ts>-<id>.md`, a new per-session file that can never collide with a peer) and re-renders the neutral `.revealui/workboard.md` **locally only**, in the correct checkout (main for SOLO, the worktree for PEER). A second render to `.claude/workboard.md` is adapter attach only. Set the volatile parts **as single-quoted literals** so a next-action containing backticks / `$(…)` / quotes is never command-substituted (`§Ordered next actions` holds exact commands + paths, which routinely use backticks):
```bash
TS="$(date -u '+%Y-%m-%d %H:%M')"
TRACK='<X pass / Y fail>'
NEXT='<one-line next action from §Ordered next actions>'   # single-quoted literal; a literal ' inside → close+reopen: '\''
```
Step 5b assembles the line with `printf %s` (never re-evaluates) and pipes it to `workboard-fragment.js` on stdin. Because the log line is a fresh file (never an edit to the shared `workboard.md`), it sidesteps both the `rogue-workboard` hook and the dirty-file guard, so this step can never strand the checkout.

## Step 5b — Commit this session's exact fragments

Default: commit and publish the two new fragment files in the isolated writer.
`--no-commit` leaves them unstaged in that writer and reports LOCAL-FILES-ONLY.
Never commit derived CURRENT-HANDOFF or either neutral/adapter workboard render.
Never stage the complete rolling or workboard directory: it may contain peer files.

```bash
LOG_FRAGMENT="$(printf -- '- [%s] %s: [CHECKPOINT] | tracking: %s | next: %s\n' \
  "$TS" "$IDENTITY" "$TRACK" "$NEXT" \
  | node "$JV_ROOT/scripts/workboard-fragment.js" --kind log --id "$CHECKPOINT_ID" \
      --base "$WORKBOARD_D")"
node "$JV_ROOT/scripts/workboard-sweep.js" --render-only \
  --workboard "$WORKBOARD" --base "$WORKBOARD_D"
node "$JV_ROOT/scripts/workboard-sweep.js" --render-only \
  --workboard "$WORKBOARD_ADAPTER" --base "$WORKBOARD_D"
HANDOFF_REL="${HANDOFF_FRAGMENT#"$JV_ROOT/"}"
LOG_REL="${LOG_FRAGMENT#"$JV_ROOT/"}"
CMSG="/tmp/cmsg-ckpt-${STAMP}.txt"
# Write the reviewed commit/PR description to CMSG as literal text before commit.
(cd "$JV_ROOT" && git add -- "$HANDOFF_REL" "$LOG_REL")
(cd "$JV_ROOT" && git -c core.fileMode=false commit -F "$CMSG" -- "$HANDOFF_REL" "$LOG_REL")
```

Publish through this repository's maintained push entrypoint. Open the proposal PR
with explicit repository, head, base and `--body-file`; apply only repository-required
non-approval metadata within authorization. Verify the remote branch points at the
checkpoint commit and record its PR. Leave merge and protected settings disposition
to the configured authority. Retain the writer if publication or validation fails.
No automatic main-checkout convergence, branch deletion or worktree removal.

## Step 5c — Prepare-for-exit verifier (read-only, runs after 5b converges)

Run the maintained read-only exit verifier in the isolated writer and preserve its
reported findings. If it still assumes derived files must be committed, record that
as a verifier defect with its owning path; do not reinterpret an unverified WARN as
PASS. Confirm this session's exact fragment publication using Git independently.

```bash
node "$JV_ROOT/scripts/prepare-for-exit.js"
```

Runs unconditionally, in both the default (5b committed) and `--no-commit` paths — under `--no-commit` its check 6 (handoff committed + pushed) is expected to WARN, which is informative, not a bug. Capture the full output verbatim; do not re-derive or re-implement its checks here. Exit code is always 0 (report-only, never blocks) — this step never changes the CHECKPOINT-READY verdict.

Step 6 surfaces this output as the PREPARE-FOR-EXIT section of the CHECKPOINT REPORT.

## Step 5c2 — Cleanup-session report (no `--fix`)

Run the registered `cleanup-session` workflow through the runner so safety classification applies ([GAP-314 §6]($JV_REPO/docs/gap-specs/GAP-314-operational-workflow-layer-design.md)). Default (no `--fix`) runs the report-first arm then `STOPPED-GATED` on the destructive arm. Capture output as **CLEANUP-SESSION** in the report. One-off destructive apply is `/cleanup --fix` (skill `revealui-cleanup`), never from checkpoint.

```bash
node "$JV_ROOT/scripts/workflow-run.js" cleanup-session
```

`STOPPED-GATED` is expected and does **not** change CHECKPOINT-READY. Do not pass `--fix` or `--yes` here.

## Step 5d — Retire only the consumed session snapshot

Archive only the snapshot resolved for this exact session, and only after its
content has been captured in a committed checkpoint whose publication was verified.
Under `--no-commit`, failed publication or unknown snapshot identity, retain it.
Use existing session-state paths and lifecycle helpers; do not age-sweep neutral or
vendor directories or move another session's files. No cleanup is required for a
valid saved checkpoint.

## Step 6 — Report preservation and remaining work

Lead with whether all requested work is recoverable. For each task repository report:

- canonical repository, branch, exact commit and worktree;
- LOCAL-SAVED / PUBLISHED / LANDED, with remote/PR evidence and observation time;
- session-owned pending files and explicitly unknown/peer-owned work;
- validation results, live review state and controller dependency;
- existing audit/handoff paths, root-cause follow-ups and exact next action.

Report the applicable tracking and exit-validator results separately. A failed
planning check, unrelated peer WIP or controller-pending PR does not mean committed,
published source was lost. Conversely, a green PR cannot stand in for uncommitted
source or an unpublished checkpoint fragment.

`CHECKPOINT-READY: YES` means all requested source and handoff artifacts have verified
committed recovery references, with no unaccounted session-owned edits. State
publication and landing independently. Use `LOCAL-FILES-ONLY` for `--no-commit`, and
`NO` when owned bytes or fidelity are missing/unaccounted. Known durable blockers
stay under outstanding work; they do not authorize a workaround or an owner-signing
request. Never call the whole fleet clean when only this task's work was checked.

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

Daemon notification is non-blocking. If it fails for any reason, the handoff is still valid: next session's SessionStart hook discovers it via filesystem — `session-start.js` / Grok SessionStart print the `[menu] CURRENT-HANDOFF` pointer (orientation only). Consume is `/pickup`. (The former Step 7.5 invoked a `session-note` skill that was never built; removed in 0.6.1.)

## Step 8 — Resume guidance

Provide a concise next-agent prompt when a session handoff is requested or chat
continuity is uncertain. Include the saved fragment path, exact repository heads,
read-first audit, active peer/controller boundary, next commands and durable blockers.
Use the user's actual integration/task lane; do not invent a product launch command.
A pending controller review is recorded as pending, not as lost source or permission
to sign an override. `/pickup` re-verifies live state before continuing.

## Boundaries

Do not commit unrelated/peer source, stage entire fragment directories, change a
shared main checkout, clear approval gates, self-merge, rewrite history, regenerate
master handoff, archive peer snapshots or remove peer worktrees. Improve a failing
validator in its owning primitive; registry entries only inventory existing debt.
Source commits belong to their owning repos; detailed evidence belongs in existing
tracked audits; coordination summaries belong in rolling/workboard fragments.

## Related ADRs / gaps (.jv)

- `docs/decisions/2026-07-23-jv-coordination-merge-model.md` — fragments-only PRs; concurrent land-as-ready
- `docs/decisions/2026-07-23-jv-merge-commit-only.md` — merge-commit policy + label
- `docs/decisions/2026-07-21-current-handoff-rolling-fragments.md` — rolling fragments (amended)
- `docs/decisions/2026-07-04-workboard-fragment-store.md` — workboard.d fragments
- `docs/decisions/2026-08-26-session-launch-record.md` — `## Launch` / rfg product id
- `docs/gap-specs/GAP-469-revskills-vendor-agnostic-design.md` — neutral session + coordination root
- `docs/gaps/GAP-469.yml` — session contract execution unit
- `docs/gaps/GAP-494.yml` — `/coordinate` live peer packet (snapshot report / checkpoint refresh)
