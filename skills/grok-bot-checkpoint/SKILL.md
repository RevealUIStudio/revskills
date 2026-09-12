---
name: grok-bot-checkpoint
description: >-
  Use when the user asks to checkpoint, /checkpoint, end a meaningful Grok Bot
  or desktop-assistant session, or leave a handoff for the next agent pickup —
  captures session state into a rolling fragment under /home/box/agent-data/checkpoints/
  and reports CHECKPOINT-READY. Portable; does not require RevealFleet layout.
license: MIT
allowed-tools: Bash, Read, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
  related:
    - revealui-checkpoint
---

# Grok Bot checkpoint

Portable session checkpoint for Grok Bot / desktop assistants. Run before ending a meaningful session so the next agent (or compacted context) can pick up cleanly.

Does **not** commit to GitHub or touch an external workboard. Durable surfaces live under `/home/box/agent-data/checkpoints/` (the public Grok Bot box layout). Override with `$CKPT_ROOT` only when that box path is absent.

Studio / RevealFleet sessions should use sibling [`revealui-checkpoint`](../revealui-checkpoint/SKILL.md) instead. This skill does not load fleet validators, workboard fragments, or `$REVEALFLEET_ROOT`.

## Layout

```
/home/box/agent-data/checkpoints/
  rolling/<ISO>-<agent-slug>.md
  CURRENT-HANDOFF.md
  snapshots/<session-id>.md
  archive/rolling/
  memory.log
```

`$CKPT_ROOT` defaults to `/home/box/agent-data/checkpoints`. Treat that tree as the only durable write surface.

## Step 1 — Resolve context

```bash
CKPT_ROOT="${CKPT_ROOT:-/home/box/agent-data/checkpoints}"
AGENT_NAME="${AGENT_NAME:-${GROK_AGENT_NAME:-${USER:-agent}}}"
AGENT_SLUG="$(printf '%s' "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//')"
[ -n "$AGENT_SLUG" ] || AGENT_SLUG="agent"
ISO_DATE="$(date -u +%Y-%m-%d)"
ISO_DATETIME="$(date -u +%Y-%m-%dT%H:%MZ)"
ISO_STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
SID="${AGENT_SESSION_ID:-${GROK_SESSION_ID:-${SESSION_ID:-}}}"
FRAGMENT="$CKPT_ROOT/rolling/${ISO_STAMP}-${AGENT_SLUG}.md"
if [ -e "$FRAGMENT" ]; then
  FRAGMENT="$CKPT_ROOT/rolling/${ISO_STAMP}-${AGENT_SLUG}-$$.md"
fi
mkdir -p "$CKPT_ROOT/rolling" "$CKPT_ROOT/snapshots" "$CKPT_ROOT/archive/rolling"
echo "ckpt root: $CKPT_ROOT"
echo "agent: $AGENT_NAME (slug=$AGENT_SLUG)"
echo "fragment: $FRAGMENT"
echo "session id: ${SID:-none}"
```

Do not invent a session id. An empty `$SID` is allowed; Step 1b then finds no snapshot.

## Step 1b — Load this session's snapshot (fidelity source)

A mid-session Snapshot skill (if installed) writes `$CKPT_ROOT/snapshots/<session-id>.md` **before compaction**. When that file exists it is the PRIMARY source for the narrative sections in Step 3 — more trustworthy than reconstructing from now-deep or already-compacted session memory.

Resolve it by **this session's id, never by mtime**. A peer's snapshot must be structurally unreachable.

```bash
SNAPSHOT=""
if [ -n "$SID" ] && [ -f "$CKPT_ROOT/snapshots/${SID}.md" ]; then
  SNAPSHOT="$CKPT_ROOT/snapshots/${SID}.md"
  echo "snapshot for this session: $SNAPSHOT (sid=$SID)"
  if grep -q '^origin: precompact-mechanical' "$SNAPSHOT"; then
    echo "WARNING: origin=precompact-mechanical — last-ditch capture, lower fidelity."
  fi
else
  echo "no snapshot for this session (${SID:-no-session-id}) — Step 3 falls back to session memory"
fi
```

If `$SNAPSHOT` is set, READ it and map its five sections onto the rolling fragment:

| Snapshot section | Fragment section |
|------------------|------------------|
| Resume-From-Here | Ordered next actions + Launch |
| What-Shipped | Last merge / ship |
| Active-Constraints | Constraints |
| Do-Not-Repeat | Do not repeat |
| Open-Loose-Ends | In-flight + Owner-gated |

Do **not** fall back to the most-recent file on disk. An unmatched or missing id means no snapshot for this session. With no snapshot, Step 3 proceeds from session memory.

## Step 2 — Inventory (gather, do not invent)

Read-only. Surface what is actually present this session. Write `none observed` rather than guessing.

Collect:

- **Agent lane** — `$AGENT_LANE` or the task theme you were assigned; do not invent a lane taxonomy
- **Memory locks** — memories or files marked locked / do-not-overwrite; skip if no memory tool is available
- **Todos** — in-session todo list (done / still open / blocked)
- **Shipped this session** — PRs, commits, files, or user-visible outcomes that actually landed
- **Open / blocked** — unfinished agent-doable work vs owner-gated leftovers
- **Peers messaged** — other agents or humans you actually contacted; omit if none

Optional, best-effort (skip if `gh` is missing, slow, or offline):

```bash
gh pr list --state open --json number,title,headRefName --limit 20
```

List only the current repo (or repos this session actually touched). Do not scan a private fleet.

## Step 3 — Write the rolling fragment

Compose PRIMARILY from the Step 1b snapshot when present, supplemented by session memory + Step 2. With no snapshot, fall back to session memory.

**Security content: cite, don't restate.** When the session touched security findings / exploits / confinement / crypto, the fragment references the artifact path only — never re-describes the technique. Same rule for the CURRENT-HANDOFF render and the CHECKPOINT REPORT.

Write `$FRAGMENT` with this spine. Fill every heading; write `none` if truly empty.

```markdown
# Checkpoint — <one-line session theme>

- agent: <AGENT_NAME>
- slug: <AGENT_SLUG>
- at: <ISO_DATETIME>
- session: <SID or none>
- snapshot: <basename or none>

## Last merge / ship

<ISO_DATE> — <AGENT_SLUG>: <≤15 words what landed>

## Launch

| Product / surface | How to resume |
|-------------------|---------------|
| <name or path> | `<exact command or first next action>` |

## Live board

| Surface | State |
|---------|--------|
| … | re-verify; do not trust stale prose |

## In-flight

- …

## Ordered next actions

1. <exact Command from ## Launch row 1>
2. …

## Owner-gated

- …   # parked for a human; next agent must not auto-run

## Do not repeat

- …

## Constraints

- …
```

Do not create dated standalone handoff files. Prefer session-specific truth in the **fragment** (unique path).

## Step 4 — Render CURRENT-HANDOFF.md (newest ≤12)

`$CKPT_ROOT/CURRENT-HANDOFF.md` is a derived read surface. Rebuild it from rolling fragments; do not hand-edit it as the source of truth.

```bash
RENDER="$CKPT_ROOT/CURRENT-HANDOFF.md"
{
  printf '# CURRENT-HANDOFF\n\n'
  printf 'Derived from rolling fragments (newest ≤12). Do not edit by hand.\n'
  printf 'Rendered: %s  agent: %s\n\n' "$ISO_DATETIME" "$AGENT_SLUG"
  find "$CKPT_ROOT/rolling" -maxdepth 1 -type f -name '*.md' | sort | tail -n 12 | while IFS= read -r f; do
    printf '---\n\n<!-- fragment: %s -->\n\n' "$(basename "$f")"
    cat "$f"
    printf '\n'
  done
} > "$RENDER"
echo "rendered: $RENDER"
```

`sort` + `tail` keeps the newest ISO-stamped names. Newest-last is fine for a rolling tape; the next agent reads from the bottom / latest `<!-- fragment: -->` block first.

Optional GC — move rolling fragments older than 7 days into `archive/rolling/`:

```bash
find "$CKPT_ROOT/rolling" -maxdepth 1 -type f -name '*.md' -mtime +7 \
  -exec mv {} "$CKPT_ROOT/archive/rolling/" \; \
  -printf 'GC-archived rolling fragment: %f\n' 2>/dev/null || true
```

Do not hand-prune `CURRENT-HANDOFF.md`. Re-render after GC if any files moved.

## Step 5 — Persist one memory log line

Append exactly one line to `$CKPT_ROOT/memory.log` (create the file if needed). Include the fragment basename and the token `CHECKPOINT-READY`. Do not write secrets.

```bash
printf '%s %s CHECKPOINT-READY fragment=%s sid=%s\n' \
  "$ISO_DATETIME" "$AGENT_SLUG" "$(basename "$FRAGMENT")" "${SID:-none}" \
  >> "$CKPT_ROOT/memory.log"
```

If a harness memory tool is available, also record that same one-liner there. Filesystem `memory.log` is the portable fallback. Do not invent a second log format.

## Step 6 — CHECKPOINT REPORT

Print this structured summary to the user (not only the assistant log):

```
=== CHECKPOINT REPORT — <ISO_DATETIME> ===

Fragment:             <path under $CKPT_ROOT/rolling/>
CURRENT-HANDOFF:      <path> (refreshed)
Memory log:           <path> (one line appended)
Snapshot consumed:    <path | none>
GitHub / workboard:   not touched (portable pack)

INVENTORY
  agent lane:                 <text | none observed>
  memory locks:               <n | none observed>
  todos open / blocked:       <n / n>
  shipped this session:       <n>
  peers messaged:             <n | none>
  open PRs (optional gh):     <n | skipped>

OUTSTANDING
  - <unfinished agent-doable todos>
  - <owner-gated items parked>
  - <blocked items>

CHECKPOINT-READY: <YES | NO — see outstanding>
```

**CHECKPOINT-READY rules:**

- `YES` only when: the rolling fragment was written **and** `CURRENT-HANDOFF.md` was refreshed **and** there are no unfinished **agent-doable** todos. Owner-gated leftovers alone are OK if they are parked under **Owner-gated** / OUTSTANDING.
- `NO` otherwise. Finish agent-doable outstanding items in-session, then re-run the verdict. Do not flip YES to NO solely because owner-gated work remains.

## Step 7 — Stop

Record + report only. Then stop.

- Do **not** promote, merge, open a PR, or send peer messages unless the user asked in this turn.
- Do **not** commit the checkpoint tree to git unless the user asked.
- Do **not** start `/pickup`, a new agent, or the next task.
- Do **not** load `revealui-checkpoint` or any Studio workboard path from here.

## Do not

- Do not invent inventory, session ids, PRs, or shipped work.
- Do not pick a snapshot by mtime or "newest file wins".
- Do not restate exploit / confinement / crypto technique — cite the artifact path only.
- Do not write outside `$CKPT_ROOT` (except an optional harness memory one-liner in Step 5).
- Do not require `$REVEALFLEET_ROOT`, `$JV_REPO`, workboard fragments, or fleet validators.
- Do not create dated standalone `HANDOFF-YYYY-MM-DD-*.md` files.
- Do not treat this skill as a Studio promote / merge gate.

## When to invoke

- End of a meaningful Grok Bot or desktop-assistant session (something shipped that needs handoff).
- Before a planned absence mid-flight.
- When the user types `/checkpoint` or asks to leave a handoff for the next agent.
- **Not** for one-off questions, read-only sessions, or aborted starts.

## Related

- **Producer (optional):** a mid-session Snapshot skill, if present, writes `$CKPT_ROOT/snapshots/<session-id>.md`. This skill consumes that file in Step 1b. Studio's producer is `revealui-snapshot` (RevealFleet layout; not required here).
- **Studio / RevealFleet variant:** [`revealui-checkpoint`](../revealui-checkpoint/SKILL.md) — tracking surfaces, workboard fragments, fleet validators. Use that skill only on RevealFleet machines.
