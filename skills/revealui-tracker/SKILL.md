---
name: revealui-tracker
description: >
  Fleet TRACKER unified surface (GAP-318 + renderer v2). Use when /tracker, /next,
  free surfaces, initiatives, roadmap graph, tracker-snapshot, re-render TRACKER,
  or after gap/lane/init membership edits. Agents must not hand-run
  initiatives-render or invent parallel queues — always use scripts/tracker.js
  under $JV_REPO.
license: MIT
allowed-tools: Bash, Read
metadata:
  author: RevealUI Studio
  version: "0.1.1"
  website: https://revealui.com
  related:
    - revealui-checkpoint
    - next
---

# Fleet TRACKER (`/tracker`)

**One CLI.** Never tell the owner (or yourself) to paste raw multi-step
render recipes. Load session helpers, then call:

```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
# $JV_REPO is set by session-state (private planning checkout)
node "$JV_REPO/scripts/tracker.js" <command>
```

| Command | What it does |
|---------|----------------|
| `ensure` (preferred entry) | Render if graph/snapshot/TRACKER missing, then status + free surfaces |
| `status` | Membership check + free surfaces + graph tip |
| `render` | Force re-write all derived views **locally** |
| `next [args]` | Free-surface menu (`--json`, `--owner-gates`, `--limit N`) |
| `snapshot` | `tracker-snapshot-v1` JSON on stdout |
| `graph` | Path + head of `docs/TRACKER.graph.md` |
| `check` | Membership validation only |

Slash aliases: **`/tracker`**, **`/next`** (→ `tracker.js next`).

## When agents MUST run this

1. **Session orientation** — SessionStart runs `tracker-session-check.js` → `tracker.js ensure`.
2. **After any edit** to `docs/gaps/*.yml`, `docs/lanes/*/plan.md`, or `docs/initiatives/*.yml`.
3. **User asks** for free surfaces, roadmap, INIT map, graph, snapshot, or “what’s next”.
4. **Before claiming work** from TRACKER (re-ensure so free surfaces match disk).

## Agent procedure (default)

```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
node "$JV_REPO/scripts/tracker.js" ensure
```

Then:

1. Pick an **open gap** or **active lane** from free surfaces (not an INIT id alone).
2. Open the gap/lane file; claim on the workboard.
3. Cut worktree from `origin/test` (product repo).

For machine consumers:

```bash
node "$JV_REPO/scripts/tracker.js" snapshot
```

## Derived views — local vs git

`render` / `ensure` write:

- `docs/TRACKER.md`
- `docs/TRACKER.graph.md`
- `docs/tracker-snapshot.json`
- `docs/initiatives/<slug>.md` dashboards

These are **derived** (coord-paths). Session PRs must **not** commit them unless
labeled `coord:allow-render-commit`. YAML remains SSOT.

### Publish derived (optional; proposal-shaped)

When the owner wants graph/snapshot on the remote integration branch: worktree from
`origin/test`, run `tracker.js render`, open a PR with labels
`coord:allow-render-commit` and `merge:merge-commit`. Owner merges with
**Create a merge commit** only. Do not self-merge without named in-session auth.

## Do not

- Do not invent parallel boards under harness homes or root TODOs.
- Do not hand-edit TRACKER / dashboards / graph / snapshot (re-render instead).
- Do not paste multi-line “run these three node scripts” into owner chat — run
  `tracker.js` yourself via this skill.
- Do not put security gap **names** into public surfaces (ids only).

## Related

- CLI: `$JV_REPO/scripts/tracker.js`
- Session: `$JV_REPO/scripts/tracker-session-check.js`
- Spec: `$JV_REPO/docs/gap-specs/GAP-318-renderer-v2.md`
- Slash docs: `$JV_REPO/docs/commands/tracker.md`
- Sibling: `revealui-checkpoint` (handoff; does not replace tracker)
