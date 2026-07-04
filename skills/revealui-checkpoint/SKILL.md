---
name: revealui-checkpoint
description: Checkpoint checklist for RevFleet sessions. Validates the 6 coherent-tracking surfaces (doc-locations, workboard, MASTER_HANDOFF staleness, lane plans, M-1 ADR tracking, M-1 frontmatter staleness), inventories tracking state (branches.json, open PRs, active lanes, uncommitted .jv changes), merges the session delta into the rolling CURRENT-HANDOFF.md, appends a workboard log entry, commits + converges the .jv delta (worktree-gated when a peer is live, per the .jv Single-Writer Discipline) unless run with --no-commit, and outputs a structured CHECKPOINT-READY report + archive-readiness next-agent prompt. Never runs master-handoff regen or auto-merges with --admin.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.6.0"
  website: https://revealui.com
---

Checkpoint orchestrator. Run before ending a meaningful session to ensure the next agent can pick up cleanly. Wires together the 6 coherent-tracking validators + 4 inventory surfaces + merges the session delta into the rolling `$JV_REPO/docs/handoffs/CURRENT-HANDOFF.md` + reports a structured CHECKPOINT-READY checklist + emits the archive-readiness next-agent prompt.

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

Rolling handoff target per `~/.claude/rules/model-allocation.md` §Session handoff loop: `$JV_REPO/docs/handoffs/CURRENT-HANDOFF.md`. Every session merges its delta here rather than creating a dated file. When the file exceeds ~150 lines, the ending session prunes shipped items to `docs/handoffs/archive/` as part of the merge (Step 4b).

## Step 1b — Load the auto-checkpoint snapshot (fidelity source)

The auto-checkpoint hooks capture a session snapshot at the soft-context line, while fidelity is still high. When one exists it is the PRIMARY source for the narrative sections in Step 4 — more trustworthy than reconstructing from now-deep session memory.

```bash
SNAP_DIR="$HOME/.claude/coordination/snapshots"
# Most-recent snapshot = the current session's (its hooks just wrote it).
SNAPSHOT="$(ls -t "$SNAP_DIR"/*.md 2>/dev/null | head -1)"
if [ -n "$SNAPSHOT" ]; then
  echo "snapshot found: $SNAPSHOT"
else
  echo "no snapshot — Step 4 falls back to session memory"
fi
```

If `$SNAPSHOT` is set, READ it and verify it is THIS session's: its `## Resume-From-Here` / `## What-Shipped` must match the work you just did. If concurrent sessions are running, the most-recent file may be a peer's — pick the one whose content is yours, or skip if none match. Use the snapshot's five sections (Resume-From-Here, What-Shipped, Active-Constraints, Do-Not-Repeat, Open-Loose-Ends) as the spine of the Step 4 merge; they map onto the rolling file's sections. With no snapshot, Step 4 proceeds from session memory as before.

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
BRANCHES_JSON="$HOME/.claude/coordination/branches.json"
if [ -f "$BRANCHES_JSON" ] && command -v jq >/dev/null 2>&1; then
  ACTIVE_COUNT="$(jq '.branches | map(select(.status == "active")) | length' "$BRANCHES_JSON")"
  echo "active branches: $ACTIVE_COUNT"
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

## Step 4 — Merge session delta into CURRENT-HANDOFF.md

**Target:** `$CURRENT_HANDOFF` — the rolling file; never create a dated HANDOFF-YYYY-MM-DD-*.md file. Read the current contents first. Compose the delta PRIMARILY from the Step 1b snapshot when present, supplemented by session memory + Step 2-3 results. With no snapshot, fall back to session memory.

Update each section using the Edit tool:

**`## Last merge`** — Replace the existing one-line value with:
```
<ISO_DATE> — <IDENTITY> (<brief session description, ≤15 words>)
```

**`## Done + verified this cycle`** — PREPEND new items from this session above the existing list. Do NOT delete prior items (Step 4b handles pruning). Each item is a one-line bullet citing PR numbers, commits, or artifact paths. Example:
```
- **admin /api/media forwarder** — [revealui#1395](url) MERGED to test; POST route + 7 tests; rides next test→main promotion.
```

**`## In-flight`** — REPLACE entirely with the current in-flight state: branches not yet merged, open PRs awaiting review or CI, uncommitted work with worktree paths, lanes with pending code. If nothing in flight: `- None.`

**`## Ordered next actions`** — REPLACE entirely with ordered mechanical next actions for the next agent. Lead with the highest-priority item. Use exact commands, file paths, branch names, PR numbers. No "investigate X" vagueness — those go in an optional `## Notes` section below. Number each action.

**`## Owner-gated`** — MERGE: keep existing items unless resolved this session, then prepend any new owner-gated items from this session.

**Optional `## Next-agent prompt (<lane>)` section** — Add or update at the end of the file when there is a specific actionable lane the next agent should pick up. Include a fenced next-agent prompt block as a convenience copy (the canonical emission happens in Step 8).

## Step 4b — Prune CURRENT-HANDOFF.md if it exceeds ~150 lines

```bash
LINE_COUNT="$(wc -l < "$CURRENT_HANDOFF")"
echo "CURRENT-HANDOFF.md: $LINE_COUNT lines"
```

If `$LINE_COUNT` exceeds approximately 150: identify items in `## Done + verified this cycle` that are clearly stale history — work that shipped in a prior cycle, whose PRs are merged, and that the next agent does not need for orientation. Move those items (only from `## Done + verified`) to an archive file:

Archive target: `$JV_ROOT/docs/handoffs/archive/CURRENT-HANDOFF-PRUNE-${ISO_DATE}.md`

Write the archive file with a short header (prune date, source section). Then use the Edit tool to remove the pruned items from `$CURRENT_HANDOFF`. Keep the most recent session's items plus anything still relevant to in-flight work or the ordered next actions. When in doubt, keep it — the goal is to prevent the file from becoming unreadably long, not to scrub history.

```bash
# Confirm prune file written (if pruning occurred)
[ -f "$JV_ROOT/docs/handoffs/archive/CURRENT-HANDOFF-PRUNE-${ISO_DATE}.md" ] && \
  echo "pruned to: docs/handoffs/archive/CURRENT-HANDOFF-PRUNE-${ISO_DATE}.md"
```

If line count is below ~150, skip this step.

## Step 5 — Workboard log entry

**Compose** this session's Log line (do NOT hand-edit `## Log` — the workboard `## Log` block is now GENERATED from per-session fragments per ADR `2026-07-04-workboard-fragment-store`, the contention-free write path):
```
- [YYYY-MM-DD HH:MM] <IDENTITY>: [CHECKPOINT] → CURRENT-HANDOFF.md | tracking: <X pass / Y fail> | next: <one-line next action from §Ordered next actions>
```

Hold it in a shell var for Step 5b, which writes it as a **fragment** (`.claude/workboard.d/log/<ts>-<id>.md` — a new per-session file that can never collide with a peer) and re-renders `workboard.md` from the fragments, in the correct checkout (main for SOLO, the worktree for PEER):
```bash
LOG_LINE="- [$(date -u '+%Y-%m-%d %H:%M')] $IDENTITY: [CHECKPOINT] → CURRENT-HANDOFF.md | tracking: <X pass / Y fail> | next: <one-line>"
```
Because the log line is a fresh file (never an edit to the shared `workboard.md`), it sidesteps both the `rogue-workboard` hook and the dirty-file guard, so this step can never strand the checkout.

## Step 5b — Commit + converge the .jv delta (worktree-gated)

DEFAULT: commit the `CURRENT-HANDOFF.md` + `workboard.md` writes and converge them to `origin/test`, so the checkpoint is durable and a concurrent `.jv` writer can't clobber it. Pass `--no-commit` to skip this and leave the writes UNSTAGED for owner review (the legacy 0.4.0 behavior) — then jump to Step 6 and list the unstaged writes under OUTSTANDING.

**CRITICAL — never strand the main checkout.** A naive commit on the MAIN `.jv` checkout was the root cause of the 8-session checkpoint-merge divergence: it left the main checkout on a `chore/checkpoint-*` branch that later merged+deleted, so every subsequent checkpoint merged onto the dead branch and never converged. The fix is the `.jv` Single-Writer Discipline — when a peer is live, do the commit from a throwaway `$JV_REPO-wt/` worktree so the main checkout never moves.

Determine the writer mode (count live interactive, non-headless `claude` sessions):
```bash
PEERS="$(node "$JV_ROOT/scripts/jv-single-writer-check.js" --count 2>/dev/null \
  || (pgrep -af claude | grep -ivE ' -p |grep|pgrep' | grep -c claude))"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CMSG="/tmp/cmsg-ckpt-${STAMP}.txt"   # write the commit message here (Step 5b uses -F)
```
If `jv-single-writer-check.js` has no `--count` mode yet, the `pgrep` fallback is authoritative.

Throughout: `core.fileMode=false` on every `.jv` commit; **explicit pathspec** `-- docs/handoffs/CURRENT-HANDOFF.md .claude/workboard.md .claude/workboard.d` (the rolling handoff + the generated workboard + this session's new log fragment; NEVER stage `tmp/` or other peer-WIP untracked); `-F "$CMSG"` messages; `--body-file` PR bodies; `--head`/`--base` explicit; **merge-COMMIT only, never squash**; NO `--admin`/`--no-verify`/`--force-push`. `.jv` `test` is branch-protected, so commits reach it via a `chore/checkpoint-*` PR. The two red checks on a `.jv` docs PR ("Doc currency stale-fact check" + "Local-gate / CI parity" — ~3s, "log not found") are the GitHub-Actions org BILLING BLOCK: non-required `UNSTABLE`, NOT real failures — merge with a plain `gh pr merge <n> --merge --delete-branch`.

**SOLO (`PEERS` ≤ 1)** — the main checkout is the only writer; commit on the current `.jv` branch directly:
```bash
cd "$JV_ROOT"
BR="chore/checkpoint-${ISO_DATE}-${IDENTITY}"
# Write this session's Log line as a fragment, then render workboard.md from fragments:
node "$JV_ROOT/scripts/workboard-fragment.js" --kind log --id "$IDENTITY" --body "$LOG_LINE"
node "$JV_ROOT/scripts/workboard-sweep.js" --render-only
git -c core.fileMode=false commit -F "$CMSG" -- docs/handoffs/CURRENT-HANDOFF.md .claude/workboard.md .claude/workboard.d
git push origin "HEAD:refs/heads/$BR"
gh pr create --base test --head "$BR" --body-file "$CMSG"     # body can reuse the message
gh pr merge <n> --merge --delete-branch
git fetch origin test && git merge --ff-only origin/test      # converge the main checkout
```

**PEER LIVE (`PEERS` > 1)** — do NOT commit on the main checkout; use a dedicated worktree so it never moves onto a chore branch:
```bash
cd "$JV_ROOT"
git fetch origin test && git merge --ff-only origin/test      # converge main FIRST; if not a clean ff, ABORT to --no-commit
WT="$JV_REPO-wt/ckpt-${ISO_DATE}-$$"; BR="chore/checkpoint-${ISO_DATE}-${IDENTITY}"
# Only CURRENT-HANDOFF.md is dirty on main now — the Log line becomes a fragment written
# IN the worktree below, and workboard.md is generated (never hand-merged):
git -c core.fileMode=false stash push -- docs/handoffs/CURRENT-HANDOFF.md  # move handoff off main (leaves tmp/ + peer-WIP untouched)
git worktree add "$WT" -b "$BR" origin/test
cd "$WT" && git -c core.fileMode=false stash pop              # reconcile CURRENT-HANDOFF.md vs current origin/test
# Write the Log fragment into THIS worktree + render its workboard from fragments. No
# workboard.md 3-way merge: peer ## Coordination Notes / Active Sessions (outside the
# fragment blocks) are carried forward from origin/test verbatim; log fragments fold in.
node "$JV_ROOT/scripts/workboard-fragment.js" --kind log --id "$IDENTITY" --base "$WT/.claude/workboard.d" --body "$LOG_LINE"
node "$JV_ROOT/scripts/workboard-sweep.js" --render-only --workboard "$WT/.claude/workboard.md" --base "$WT/.claude/workboard.d"
git -c core.fileMode=false commit -F "$CMSG" -- docs/handoffs/CURRENT-HANDOFF.md .claude/workboard.md .claude/workboard.d
git push origin "HEAD:refs/heads/$BR"
gh pr create --base test --head "$BR" --body-file "$CMSG"
gh pr merge <n> --merge --delete-branch
cd "$JV_ROOT" && git worktree remove "$WT"                    # cleanup
git fetch origin test && git merge --ff-only origin/test      # converge main
```

**Cleanup + failure handling.** On success the temp worktree is removed and the chore branch deleted (`--delete-branch`). On ANY failure — the initial converge is not a clean fast-forward, an unresolved `stash pop` conflict, or a push/merge error — DO NOT silently drop the delta: surface the stash ref (`git stash list`) or the worktree path, fall back to the `--no-commit` end state (writes left for the owner), and leave the main checkout on its original branch. Never leave the main checkout on a `chore/checkpoint-*` branch.

## Step 6 — Report

Print this structured summary to the user (NOT just the assistant log — actual user-facing report):

```
=== CHECKPOINT REPORT — <ISO_DATETIME> ===

Handoff merged:       <CURRENT_HANDOFF>
Workboard updated:    <WORKBOARD>
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

OUTSTANDING (action by owner or next agent)
  - <enumerate each FAIL item with suggested fix>
  - <enumerate uncommitted/unpushed work>
  - <enumerate owner-gated items>

CHECKPOINT-READY: <YES | NO — see outstanding>
```

**CHECKPOINT-READY rules:**
- `YES` only when: all 6 validators PASS (or only `master-handoff-staleness` is STALE which is non-blocking) AND uncommitted .jv changes are zero (or explicitly peer-WIP untracked files only) AND every open PR for the active branches is either GREEN-AND-MERGEABLE or owner-gated.
- `NO` otherwise. Owner must address outstanding items before letting the session close.

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

Daemon notification is non-blocking. If it fails for any reason, the handoff is still valid: next session's SessionStart hook discovers it via filesystem.

## Step 7.5 — Leave /session-note

Invoke the `session-note` skill (Skill tool) pointing at CURRENT-HANDOFF.md. This note surfaces in the next session's `[beacons]` block automatically and is the lowest-friction way for the next agent to orient before any context is loaded.

Suggested note text: `Handoff merged into $JV_REPO/docs/handoffs/CURRENT-HANDOFF.md — read first. Top action: <first item from §Ordered next actions>.`

## Step 8 — Emit copy-pasteable next-agent prompt (LAST output — nothing after this)

Per `~/.claude/rules/coordination.md` §"Archive-Readiness Convention" (2026-05-11): the final output of any checkpoint flow MUST be a copy-pasteable "next-agent prompt" the owner can drop straight into a new Claude Code session — no synthesis required, no jumping between docs. **The prompt is non-negotiable.** Without it, the owner has to do friction work (read CURRENT-HANDOFF.md + workboard + memories + figure out the first action) every multi-session handoff. That friction compounds across the fleet.

Compose the prompt with these 5 sections (in order):

1. **First line** — `Session <session-id> — read first: $JV_REPO/docs/handoffs/CURRENT-HANDOFF.md`. The path is the absolute filesystem path to the rolling handoff file.
2. **TL;DR** — 1–2 sentences with the single most important next action. Mirror §"Ordered next actions" item 1 from CURRENT-HANDOFF.md; do not re-summarize.
3. **Ordered next-actions** — numbered list with EXACT commands / values / file paths. No "investigate X" / "decide Y" / "look into Z" — those belong in CURRENT-HANDOFF.md body. Pre-resolve every path, hash, branch name, PR number. If the next-agent has to fill in `<paste prod URL here>`, the convention has been violated.
4. **Locked-posture reminder** — one line. HARDLINES: `core.fileMode=false` on every .jv commit; explicit pathspec (preserve peer-WIP untracked); `-F /tmp/cmsg-*.txt` for commit messages; `--body-file` for PR/issue bodies; `--head`/`--base` explicit on `gh pr create`; no `--auto`/`--no-verify`/`--admin`/`--force-push`; audit-first SDLC HARDLINE; no regex authored; no Stripe live-flip without owner directive; revvault-first secrets; durable-only.
5. **Owner-gated deferrals** — one short list of items the next agent must NOT auto-pick up without explicit owner sign-off.

Emit the prompt wrapped in a single triple-backtick fenced code block. The block must be the LAST thing emitted in the turn — no commentary, no "and that's it" trailer, nothing.

If the Step 6 verdict is `CHECKPOINT-READY: NO`, the TL;DR must lead with `BLOCKED: <reason>. Resolve before next session.` and the NEXT ACTIONS list must enumerate the blockers (failed validators, uncommitted state, open PRs without owner-gate clearance) as items to clear first.

If the session was a no-op (nothing shipped, no in-flight work), still emit the prompt — TL;DR reads `SESSION END — no follow-up required. Next agent starts fresh.` and NEXT ACTIONS list is empty (the section header still appears for symmetry).

The same content should be in CURRENT-HANDOFF.md §"Next-agent prompt" (optional Step 4 section). The chat emission is for immediate copy-paste; CURRENT-HANDOFF.md is for recovery if chat closes before paste.

## Do not

- Do NOT emit ANY text or tool call after Step 8's fenced prompt block. The block is the last thing in the turn — the owner triple-clicks to select.
- Do NOT auto-commit on the MAIN `.jv` checkout — committing there strands it on a `chore/checkpoint-*` branch (the 8-session divergence bug). Commit ONLY via Step 5b (worktree-gated when a peer is live), or pass `--no-commit` to defer to the owner. Still NEVER auto-merge with `--admin` or squash.
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

**Arguments:** `/checkpoint --no-commit` skips Step 5b and leaves the `CURRENT-HANDOFF.md` + workboard writes UNSTAGED for the owner to review/commit (the pre-0.5.0 behavior) — use it when the handoff needs an eyeball before it lands. The default (no flag) commits + converges the delta to `.jv` `test` per Step 5b.

## Relationship to /handoff

`/handoff` is the predecessor — writes a basic handoff doc to the (now non-canonical) `.claude/handoffs/` location with no tracking-surface validation. `/checkpoint` supersedes it: rolling merge into CURRENT-HANDOFF.md + 6 validators + inventory + structured report. Recommend the slash command symlink at `~/.claude/commands/handoff.md` be retargeted to this skill in a follow-up (separate revskills PR).
