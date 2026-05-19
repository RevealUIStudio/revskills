---
name: revealui-prepare-archive
description: Pre-archive checklist for RevFleet sessions. Validates the 6 coherent-tracking surfaces (doc-locations, workboard, MASTER_HANDOFF staleness, lane plans, M-1 ADR tracking, M-1 frontmatter staleness), inventories tracking state (branches.json, open PRs, active lanes, uncommitted .jv changes), writes a handoff doc at the canonical `docs/HANDOFF-*.md` root, appends a workboard log entry, and outputs a structured READY-TO-ARCHIVE report. Non-destructive — never auto-commits or runs master-handoff regen.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

Pre-archive orchestrator. Run before ending a meaningful session to ensure the next agent can pick up cleanly. Wires together the 6 coherent-tracking validators + 4 inventory surfaces + writes a canonical-location handoff + reports a structured READY-TO-ARCHIVE checklist.

Authority on locations + tiers: [`master-handoff.md`](~/revfleet/.jv/.claude/rules/master-handoff.md) (active at `docs/HANDOFF-*.md` root; archive at `docs/handoffs/archive/`). Authority on doc-location enforcement: [`jv-doc-locations.md`](~/revfleet/.jv/.claude/rules/jv-doc-locations.md).

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Step 1 — Resolve context

```bash
IDENTITY="$(ss_identity)"
REPO="$(ss_active_repo)"
JV_ROOT="$HOME/revfleet/.jv"
WORKBOARD="$JV_ROOT/.claude/workboard.md"
ISO_DATE="$(date -u +%Y-%m-%d)"
ISO_DATETIME="$(date -u +%Y-%m-%dT%H:%MZ)"
# Optional topic from $ARGUMENTS; default to identity-based slug.
TOPIC="${ARGUMENTS:-session-archive}"
TOPIC_SLUG="$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '-')"
HANDOFF_FILE="$JV_ROOT/docs/HANDOFF-${ISO_DATE}-${TOPIC_SLUG}.md"
```

Canonical handoff location per `master-handoff.md`: `~/revfleet/.jv/docs/HANDOFF-YYYY-MM-DD-*.md` at root. Active stays here until 7-day mtime; `master-handoff-regen.js` sweeps to `docs/handoffs/archive/`. Never write to `~/revfleet/.jv/.claude/handoffs/` (non-canonical) or `/tmp/agent-handoff-*.md` (orphaned).

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
~/revfleet/revealui/node_modules/.bin/tsx "$JV_ROOT/scripts/m1-adr-tracking-check.ts" --mode=ci
```
Every ADR (post-2026-05-16 cutoff) must carry `tracking-issue:` frontmatter.

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
for repo in revealui revealui-jv revvault revdev revforge revkit revskills revealcoin revcon; do
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

## Step 4 — Write handoff document

Write to `$HANDOFF_FILE` (canonical: `docs/HANDOFF-YYYY-MM-DD-*.md` root) using this template. Fill `TODO:` sections from session memory + Step 2-3 results:

```markdown
---
from: <IDENTITY>
to: <suggested next identity or "ensemble">
created: <ISO_DATETIME>
repo: <REPO>
branch: <branch name>
topic: <TOPIC>
related-lanes: []   # add lane-ids if this session touched specific lanes
---

# Handoff — <ISO_DATETIME> — <TOPIC>

## Resume From Here
TODO: one sentence — the single most important next action. Name files, functions, commands. No vague wording.

## What Shipped This Session
TODO: PRs opened/merged, commits, durable artifacts. Include URLs.

## Active Constraints
TODO: decisions not yet committed to CLAUDE.md / MASTER_PLAN.md / a lane plan. Owner-gated holds.

## Do Not Repeat
TODO: tried approaches, already-rejected paths, peer-WIP territory to avoid.

## Tracking-Surface State (from Step 2-3 of /prepare-archive)
- doc-locations-check:           <PASS | N violations>
- workboard freshness:           <FRESH | WARN>
- MASTER_HANDOFF staleness:      <FRESH | STALE | EXPIRED>
- lanes-check:                   <PASS | N issues>
- m1-adr-tracking:               <PASS | N missing>
- m1-frontmatter-staleness:      <PASS | N stale>
- active branches (branches.json): <N>
- open PRs across fleet:         <N>
- active lanes:                  <N>
- uncommitted .jv changes:       <N files>

## Open Loose Ends
TODO: anything uncommitted, unpushed, pending CI, awaiting review, owner-gated, deferred.

## Locked Posture
- audit-first SDLC (HARDLINE)
- core.fileMode=false on every .jv commit
- explicit pathspec on every commit (preserve peer-WIP untracked)
- -F /tmp/cmsg-*-<sessionid>.txt for commit messages
- --body-file for PR/issue bodies (no bash heredoc)
- --base test (revealui) or --base main (.jv); --head explicit
- no --auto, no --no-verify, no --admin, no --force-push
- no regex authored (AST/typed predicates/Intl.Segmenter only)
- revvault-first secrets; no env-var fallbacks
- durable-only HARDLINE
- questions one-at-a-time

## Relevant Memories
<list memory files touched or surfaced this session>

## Next-Agent Prompt

Copy-pasteable prompt for the next Claude Code session. Triple-click the fenced block below to select; paste into a fresh session as the first message. Per `~/.claude/rules/coordination.md` §"Archive-Readiness Convention" (2026-05-11). Same content is also emitted to chat by Step 8 of /prepare-archive — duplicated here so it survives the chat closing.

\`\`\`
Session <SESSION_ID> — read first: <HANDOFF_FILE absolute path>

TL;DR: <1–2 sentences mirroring §Resume From Here above>

NEXT ACTIONS (mechanical, ready-to-run):

1. <command + exact args>
2. <command + exact args>
3. <command + exact args>

LOCKED POSTURE: audit-first SDLC HARDLINE; `core.fileMode=false` on every .jv commit; explicit pathspec (preserve peer-WIP untracked); `-F /tmp/cmsg-*.txt` for commit messages; `--body-file` for PR/issue bodies; `--head`/`--base` explicit on `gh pr create`; no `--auto`/`--no-verify`/`--admin`/`--force-push`; no regex authored; no Stripe live-flip without owner directive; revvault-first secrets; durable-only.

OWNER-GATED (do NOT auto-pick up without explicit sign-off):
- <item 1>
- <item 2>
\`\`\`
```

Use the Write tool for this file. Then `git add` it with explicit pathspec.

## Step 5 — Workboard log entry

Append one line under `## Log` in `$WORKBOARD`:
```
- [YYYY-MM-DD HH:MM] <IDENTITY>: [PRE-ARCHIVE] → <HANDOFF_FILE> | tracking: <X pass / Y fail> | next: <one-line next action from §Resume From Here>
```

Use Edit tool with old_string targeting the existing `## Log` header (insert immediately after). Do not rewrite the workboard.

## Step 6 — Report

Print this structured summary to the user (NOT just the assistant log — actual user-facing report):

```
=== PRE-ARCHIVE REPORT — <ISO_DATETIME> ===

Handoff written:      <HANDOFF_FILE>
Workboard updated:    <WORKBOARD>

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

READY-TO-ARCHIVE: <YES | NO — see outstanding>
```

**READY-TO-ARCHIVE rules:**
- `YES` only when: all 6 validators PASS (or only `master-handoff-staleness` is STALE which is non-blocking) AND uncommitted .jv changes are zero (or explicitly peer-WIP untracked files only) AND every open PR for the active branches is either GREEN-AND-MERGEABLE or owner-gated.
- `NO` otherwise. Owner must address outstanding items before letting the session close.

## Step 7 — Optionally notify daemon

If the RPC daemon is up (`ss_daemon_alive`) and `nc` is installed, post an `archive` event (advisory — not required):
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
    '{type:"pre-archive", file:$file, from:$from}')"
  if printf '%s\n' "$PAYLOAD" | nc -U -w 1 "$DAEMON_SOCKET" >/dev/null 2>&1; then
    DAEMON_NOTIFIED="yes"
  else
    DAEMON_NOTIFY_REASON="nc-write-failed"
  fi
fi
```

Daemon notification is non-blocking. If it fails for any reason, the handoff is still valid: next session's SessionStart hook discovers it via filesystem.

## Step 8 — Emit copy-pasteable next-agent prompt (LAST output — nothing after this)

Per `~/.claude/rules/coordination.md` §"Archive-Readiness Convention" (2026-05-11): the final output of any archive flow MUST be a copy-pasteable "next-agent prompt" the owner can drop straight into a new Claude Code session — no synthesis required, no jumping between docs. **The prompt is non-negotiable.** Without it, the owner has to do friction work (read handoff doc + workboard + memories + figure out the first action) every multi-session handoff. That friction compounds across the fleet.

Compose the prompt with these 5 sections (in order):

1. **First line** — `Session <session-id> — read first: <absolute path to HANDOFF_FILE>`. The path is the absolute filesystem path (`~/revfleet/.jv/docs/HANDOFF-YYYY-MM-DD-*.md`), not a relative path.
2. **TL;DR** — 1–2 sentences with the single most important next action. Mirror §"Resume From Here" from the handoff doc; do not re-summarize.
3. **Ordered next-actions** — numbered list with EXACT commands / values / file paths. No "investigate X" / "decide Y" / "look into Z" — those belong in handoff §"Open Loose Ends". Pre-resolve every path, hash, branch name, PR number. If the next-agent has to fill in `<paste prod URL here>`, the convention has been violated.
4. **Locked-posture reminder** — one line. HARDLINES: `core.fileMode=false` on every .jv commit; explicit pathspec (preserve peer-WIP untracked); `-F /tmp/cmsg-*.txt` for commit messages; `--body-file` for PR/issue bodies; `--head`/`--base` explicit on `gh pr create`; no `--auto`/`--no-verify`/`--admin`/`--force-push`; audit-first SDLC HARDLINE; no regex authored; no Stripe live-flip without owner directive; revvault-first secrets; durable-only.
5. **Owner-gated deferrals** — one short list of items the next agent must NOT auto-pick up without explicit owner sign-off.

Emit the prompt wrapped in a single triple-backtick fenced code block. The block must be the LAST thing emitted in the turn — no commentary, no "and that's it" trailer, nothing.

If the Step 6 verdict is `READY-TO-ARCHIVE: NO`, the TL;DR must lead with `BLOCKED: <reason>. Resolve before next session.` and the NEXT ACTIONS list must enumerate the blockers (failed validators, uncommitted state, open PRs without owner-gate clearance) as items to clear first.

If the session was a no-op (nothing shipped, no in-flight work), still emit the prompt — TL;DR reads `SESSION END — no follow-up required. Next agent starts fresh.` and NEXT ACTIONS list is empty (the section header still appears for symmetry).

Same content was already written to the handoff doc's §"Next-Agent Prompt" section (Step 4). The chat emission is for immediate copy-paste; the handoff doc is for recovery if chat closes before paste.

## Do not

- Do NOT emit ANY text or tool call after Step 8's fenced prompt block. The block is the last thing in the turn — the owner triple-clicks to select.
- Do NOT auto-commit anything — let the owner decide what to commit (handoff doc + workboard line are written but unstaged; they show up in `git status` for owner to commit explicitly).
- Do NOT run `master-handoff-regen.js` — that's a separate audited operation (agent-invoked, owner-attended, expensive).
- Do NOT move or delete handoff files — the 7-day sweep handles that.
- Do NOT modify lane plans or MASTER_PLAN.md — validators here are READ-ONLY against body content.
- Do NOT write the handoff to `~/revfleet/.jv/.claude/handoffs/` (non-canonical; retired 2026-05-19 in favor of `docs/HANDOFF-*.md` root per master-handoff.md).
- Do NOT write to `/tmp/agent-handoff-*.md` (orphaned by design).
- Do NOT reference tmux, tmux windows, panes, or `TMUX_PANE` — Studio-native.
- Do NOT attempt to spawn a new agent process — the user (or Studio UI) controls session creation.

## When to invoke

- End of a meaningful session (something shipped that needs handoff).
- Before a planned absence (owner stepping away mid-flight).
- When the user types `/prepare-archive`, `/prepare-archive <topic>`, or the Stop hook decides to run a final check.
- NOT for one-off questions, read-only sessions, or aborted starts.

## Relationship to /handoff

`/handoff` is the predecessor — writes a basic handoff doc to the (now non-canonical) `.claude/handoffs/` location with no tracking-surface validation. `/prepare-archive` supersedes it: canonical location + 6 validators + inventory + structured report. Recommend the slash command symlink at `~/.claude/commands/handoff.md` be retargeted to this skill in a follow-up (separate revskills PR).
