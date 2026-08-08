---
name: revealui-tracker
description: >
  Fleet TRACKER auto-sync (GAP-318 + goal spine). Use when /tracker, /next,
  free surfaces, roadmap, goals, or after gap/lane/init membership edits.
  Owner never runs shell commands — agents and SessionStart call tracker.js
  sync. Do not invent parallel queues or paste CLI recipes for the owner.
license: MIT
allowed-tools: Bash, Read
metadata:
  author: RevealUI Studio
  version: "0.2.0"
  website: https://revealui.com
  related:
    - revealui-checkpoint
    - next
---

# Fleet TRACKER (`/tracker`) — owner-zero shell

**Public-repo hygiene:** never hardcode private clone paths or private repo
names. Resolve planning checkout via `$JV_REPO` from `session-state.sh` only.
Do **not** add this skill to `.leakignore`.

## Owner experience (non-negotiable)

The owner talks in **chat** (“what’s next”, “roadmap”, “sync the board”).  
Agents **never** tell the owner to run `node scripts/…` or systemd recipes.  
If something is deferred (daemon down, license FREE), report that in one line
and keep going with the file TRACKER board — do not invent workarounds that
require owner shell steps.

## What agents run (silently)

```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
node "$JV_REPO/scripts/tracker.js" sync
```

`sync` (default entry):

1. Refresh derived TRACKER / graph / snapshot if missing  
2. Soft-project snapshot → daemon goals when the licensed daemon is up  
3. Print free surfaces for claiming  
4. **Where-are-we** — goal `%` + nextActions for free-surface gaps (Phase 3; soft if offline)

Soft-project / goals overlay never fail the session  
(`TRACKER_SKIP_PROJECT=1`, `TRACKER_SKIP_GOALS_OVERLAY=1` to disable).

| Trigger | Agent duty |
|---------|------------|
| SessionStart | Already calls `tracker-session-check` → `sync` |
| After editing gap / lane / initiative YAML | Run `sync` before wrap-up |
| Owner asks free surfaces / roadmap / goals | Run `sync`, answer from output |
| Daemon/license deferred | Note once; use TRACKER.md free surfaces |

## Commands (agents only — not owner paste)

| Command | Use |
|---------|-----|
| `sync` / `ensure` | Default auto path |
| `status` | Read-only free surfaces (no project) |
| `next` | Free-surface menu (`--json`, `--owner-gates`) |
| `project` | Force goal project (when diagnosing) |
| `snapshot` / `graph` | Machine views |

Slash: **`/tracker`**, **`/next`**.

## Claim flow after sync

1. Pick an **open gap** or **active lane** (not INIT id alone).  
2. Claim on the workboard.  
3. Worktree from `origin/test` in the product repo.

## Do not

- Do not invent parallel boards under harness homes.  
- Do not hand-edit TRACKER / dashboards / graph / snapshot.  
- Do not paste multi-line shell recipes into owner chat.  
- Do not put security gap **names** on public surfaces.

## Related

- `$JV_REPO/scripts/tracker.js`  
- `$JV_REPO/scripts/tracker-session-check.js`  
- Sibling: `revealui-checkpoint`
