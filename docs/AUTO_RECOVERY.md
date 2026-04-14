# Auto-Recovery Launcher

When a Claude Code session dies (crash, OOM, WSL hang), a fresh session should open automatically, run a recovery diagnostic, and — if nothing needs human authorization — resume work without the user touching the keyboard. This directory ships the wrapper and the supporting skill that make that happen.

## Goal

Zero-touch recovery for common failure modes:

1. Session dies with non-zero exit.
2. A new terminal tab opens within ~2s, in the same shell environment, running `claude 'recover'`.
3. The recovery skill classifies findings. If every finding is on a closed auto-heal allowlist (stale tmp files, dead-ppid cleanup, daemon re-registration), it auto-proceeds. Anything outside the allowlist stops and asks.
4. User returns to find either (a) work resumed with a summary, or (b) a diagnostic waiting for one `y`.

## Non-goals

- Not a replacement for the `/recover` skill (still the recovery engine).
- Not a session-persistence mechanism — context is rebuilt from rolling state snapshots and git, not serialized.
- No tmux or pane management. Terminal-native.

## Components

### 1. `claude-safe` wrapper (`bin/claude-safe`)

A launcher that `exec`s the real `claude` binary, watches the exit code, and spawns a recovery tab on crash.

- Exit codes `0`, `130` (SIGINT), `143` (SIGTERM) — pass through, no relaunch.
- Anything else — crash: write a JSON crash marker and spawn a new Windows Terminal tab running `claude 'recover'`.
- Rate-limited: if 3+ crashes land in `/tmp/claude-crash-*.json` within 5 minutes, stop auto-relaunching.
- Crash markers use `jq -n --arg` for injection-safe JSON, with a base64 fallback if `jq` is absent.

**Why a wrapper, not a Stop hook:** Stop hooks run inside the dying process. If Claude itself is deadlocked, the hook never fires. The wrapper runs in the parent shell and catches any non-zero exit including SIGKILL.

**Why launch recovery from `$HOME`, not the crashed repo:** `cd`-ing into a repo with an `.envrc` triggers direnv, which can trigger a cold Nix flake evaluation (observed: 3+ GiB download mid-recovery). The wrapper launches from `$HOME` and exports `REVEALUI_CRASHED_REPO=<repo>` so the recovery skill can still target the right project without entering the direnv-watched directory.

### 2. Rolling last-state snapshot (Stop hook)

On every turn-end, a Stop hook writes `/tmp/claude-last-state-<ppid>.json` capturing repo, branch, HEAD, dirty-count, last user turn, and tool counts. Because Stop hooks don't fire on SIGKILL, this rolling breadcrumb is what the recovery skill reads to reconstruct "what was I doing before the crash?"

### 3. `/recover` auto-proceed

The recovery skill classifies every finding into two buckets:

- **Safe to auto-heal:** dead-ppid `/tmp` files, orphaned read-only handoffs, dead run-task reattach, RPC daemon re-registration, reachability re-probes.
- **Requires authorization:** git corruption, uncommitted work, destructive operations, production config changes.

If the requires-authorization list is empty, the skill emits `AUTO_PROCEED` and executes the recommended actions. Otherwise it prints findings and stops, exactly like a user-invoked `/recover`.

The allowlist is closed: anything not on it stops for human review. This preserves the guard that catches git corruption.

## Installation

```bash
bash "$HOME/suite/revskills/bin/install.sh"
```

The install script symlinks each executable in `bin/` into `~/.local/bin/`. It is idempotent, refuses to overwrite regular files (back them up first), and accepts `REVSKILLS_BIN_TARGET=<dir>` for non-default targets.

Verify:

```bash
command -v claude-safe
claude-safe --simulate-crash 42   # dry run, no real claude invocation
```

`--simulate-crash [exit]` skips the real `claude` call, writes a crash marker, and spawns the recovery tab. Use it to verify the spawn path without killing a live session.

## Real SIGKILL test

1. Terminal A: `cd <your-repo> && claude-safe`
2. Terminal B: `pgrep -af 'claude$'` → `kill -KILL <pid>`
3. A new terminal tab opens within ~2s, launches `/recover`, classifies findings, and auto-proceeds if clean.

## Failure modes

| Mode | Mitigation |
|------|------------|
| `wt.exe` not in PATH from WSL | Wrapper prints manual recovery instructions to stderr instead of spawning |
| 3+ crashes in 5 min (loop) | Rate limit: wrapper stops auto-relaunching, user runs recovery manually |
| Recovery tab stalls on cold Nix flake eval | Wrapper launches recovery from `$HOME`, passes `REVEALUI_CRASHED_REPO` so the skill still targets the right project |
| Two recovery tabs spawn (race) | Crash markers are per-pid-per-timestamp; auto-heal is idempotent |
| Auto-proceed takes destructive action | Closed auto-heal allowlist; anything unknown stops for review |

## Environment hooks

The wrapper respects these overrides:

| Variable | Purpose | Default |
|----------|---------|---------|
| `REVEALUI_WT_EXE` | Absolute path to `wt.exe` | Auto-detect via `$PATH` |
| `WSL_DISTRO_NAME` | Target WSL distro for recovery tab | `Ubuntu` |
| `REVEALUI_IDENTITY` | Identity label written to crash marker | `$(whoami)` |

## Related

- Recovery skill: `skills/revealui-recover/SKILL.md`
- Shared helpers: `scripts/lib/session-state.sh`
- Batch skill lint (CI): `scripts/lint-all-skills.sh`
