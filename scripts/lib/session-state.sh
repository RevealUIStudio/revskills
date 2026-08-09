#!/usr/bin/env bash
# Shared session-state helpers for continuity skills (/recover, /checkpoint,
# /snapshot, /doctor). Vendor-agnostic (GAP-469).
#
# Source from the revskills tree (canonical):
#   . "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
# Claude-home copy paths (if any) are adapters, not the SSOT.

REVFLEET_ROOT="${REVFLEET_ROOT:-$HOME/revfleet}"
REVEALUI_REPO="${REVEALUI_REPO:-$REVFLEET_ROOT/revealui}"
JV_REPO="${JV_REPO:-$REVFLEET_ROOT/.jv}"
WORKBOARD="${WORKBOARD:-$JV_REPO/.claude/workboard.md}"
DAEMON_SOCKET="${REVEALUI_SOCKET:-${DAEMON_SOCKET:-$HOME/.local/share/revealui/harness.sock}}"

# Neutral coordination root (SSOT). Claude/Grok homes may hold legacy copies.
REVEALUI_COORD_ROOT="${REVEALUI_COORD_ROOT:-$HOME/.local/share/revealui/coordination}"
# Legacy Claude adapter path (read-through only after neutral).
REVEALUI_COORD_LEGACY_CLAUDE="${REVEALUI_COORD_LEGACY_CLAUDE:-$HOME/.claude/coordination}"

# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------

ss_identity() {
  if [ -n "${REVEALUI_IDENTITY:-}" ]; then
    printf '%s\n' "$REVEALUI_IDENTITY"
    return 0
  fi
  if [ -n "${AGENT_ROLE:-}" ]; then
    printf '%s\n' "$AGENT_ROLE"
    return 0
  fi
  if [ -n "${CLAUDE_AGENT_ROLE:-}" ]; then
    printf '%s\n' "$CLAUDE_AGENT_ROLE"
    return 0
  fi
  local cache
  cache="$(ls -t /tmp/revealui-session-*.id 2>/dev/null | head -1)"
  if [ -n "$cache" ] && [ -s "$cache" ]; then
    head -1 "$cache"
    return 0
  fi
  printf 'stagehand\n'
}

# ---------------------------------------------------------------------------
# Session id (GAP-469) — automatic; operator never exports by hand
#
# Order (first non-empty wins):
#   1. AGENT_SESSION_ID / REVEALUI_SESSION_ID (explicit override)
#   2. Vendor env aliases: CLAUDE_CODE_SESSION_ID, GROK_SESSION_ID
#   3. PPID stamp files written by SessionStart (scripts/stamp-session-id.sh)
#   4. Grok ~/.grok/active_sessions.json matched by ancestor PID (or sole cwd)
#
# Snapshot write requires a value. Checkpoint consume may be empty (memory).
# ---------------------------------------------------------------------------

# Collect ancestor PIDs of a process (inclusive), space-separated. Arg: start pid.
ss_ancestor_pids() {
  local pid="$1" pids="" n=0
  [ -n "$pid" ] || return 1
  while [ "$pid" -gt 1 ] && [ "$n" -lt 40 ]; do
    pids="${pids}${pids:+ }${pid}"
    pid="$(awk '/^PPid:/{print $2}' "/proc/${pid}/status" 2>/dev/null)" || break
    n=$((n + 1))
  done
  printf '%s\n' "$pids"
}

# Stamp files: $REVEALUI_COORD_ROOT/harness-sessions/by-pid/<pid> → session id
ss_session_id_from_pid_stamps() {
  local root="$REVEALUI_COORD_ROOT/harness-sessions/by-pid"
  [ -d "$root" ] || return 1
  local pid sid
  # shellcheck disable=SC2046
  for pid in $(ss_ancestor_pids "$$"); do
    if [ -f "$root/$pid" ] && [ -s "$root/$pid" ]; then
      sid="$(head -1 "$root/$pid" | tr -d '[:space:]')"
      if [ -n "$sid" ]; then
        printf '%s\n' "$sid"
        return 0
      fi
    fi
  done
  return 1
}

# Grok active_sessions.json: match ancestor PID, else sole open session for $PWD.
ss_session_id_from_grok_active() {
  local active="${GROK_ACTIVE_SESSIONS:-$HOME/.grok/active_sessions.json}"
  [ -f "$active" ] || return 1
  command -v python3 >/dev/null 2>&1 || return 1
  # shellcheck disable=SC2086
  python3 - "$active" "$$" "${PWD:-}" <<'PY'
import json, sys

path, start_s, cwd = sys.argv[1], sys.argv[2], sys.argv[3]
start = int(start_s)
pids = set()
pid = start
for _ in range(40):
    pids.add(pid)
    try:
        with open(f"/proc/{pid}/status", encoding="utf-8") as fh:
            ppid = None
            for line in fh:
                if line.startswith("PPid:"):
                    ppid = int(line.split()[1])
                    break
        if ppid is None or ppid <= 1:
            break
        pid = ppid
    except OSError:
        break

try:
    sessions = json.loads(open(path, encoding="utf-8").read())
except (OSError, json.JSONDecodeError):
    sys.exit(1)
if not isinstance(sessions, list):
    sys.exit(1)

for s in sessions:
    try:
        if int(s.get("pid", -1)) in pids and s.get("session_id"):
            print(s["session_id"])
            sys.exit(0)
    except (TypeError, ValueError):
        continue

# Sole open session for this cwd (safe when only one Grok in the workspace)
cands = [s for s in sessions if s.get("cwd") == cwd and s.get("session_id")]
if len(cands) == 1:
    print(cands[0]["session_id"])
    sys.exit(0)
sys.exit(1)
PY
}

ss_session_id() {
  if [ -n "${AGENT_SESSION_ID:-}" ]; then
    printf '%s\n' "$AGENT_SESSION_ID"
    return 0
  fi
  if [ -n "${REVEALUI_SESSION_ID:-}" ]; then
    printf '%s\n' "$REVEALUI_SESSION_ID"
    return 0
  fi
  if [ -n "${CLAUDE_CODE_SESSION_ID:-}" ]; then
    printf '%s\n' "$CLAUDE_CODE_SESSION_ID"
    return 0
  fi
  if [ -n "${GROK_SESSION_ID:-}" ]; then
    printf '%s\n' "$GROK_SESSION_ID"
    return 0
  fi
  local sid
  sid="$(ss_session_id_from_pid_stamps 2>/dev/null)" && {
    printf '%s\n' "$sid"
    return 0
  }
  sid="$(ss_session_id_from_grok_active 2>/dev/null)" && {
    printf '%s\n' "$sid"
    return 0
  }
  return 1
}

# ---------------------------------------------------------------------------
# Coordination paths
# ---------------------------------------------------------------------------

ss_coord_root() {
  printf '%s\n' "$REVEALUI_COORD_ROOT"
}

ss_snap_dir() {
  printf '%s\n' "$REVEALUI_COORD_ROOT/snapshots"
}

ss_snap_archive_dir() {
  printf '%s\n' "$REVEALUI_COORD_ROOT/snapshots/archive"
}

ss_ensure_coord_dirs() {
  mkdir -p "$REVEALUI_COORD_ROOT/snapshots/archive" \
    "$REVEALUI_COORD_ROOT/harness-sessions/by-pid"
}

# branches.json: prefer neutral SSOT; fall back to legacy Claude path if present.
ss_branches_json() {
  local neutral="$REVEALUI_COORD_ROOT/branches.json"
  local legacy="$REVEALUI_COORD_LEGACY_CLAUDE/branches.json"
  if [ -f "$neutral" ]; then
    printf '%s\n' "$neutral"
    return 0
  fi
  if [ -f "$legacy" ]; then
    printf '%s\n' "$legacy"
    return 0
  fi
  printf '%s\n' "$neutral"
}

# Resolve snapshot file for this session (id-match, never mtime).
# Search order: neutral SSOT, then legacy Claude adapter path.
# Prints path and returns 0 if found; returns 1 if no session id or no file.
# Optional $1 session id; callers usually omit and resolve via ss_session_id.
# shellcheck disable=SC2120
ss_snapshot_path() {
  local sid="${1:-}"
  if [ -z "$sid" ]; then
    sid="$(ss_session_id 2>/dev/null)" || return 1
  fi
  [ -n "$sid" ] || return 1

  local candidates=(
    "$REVEALUI_COORD_ROOT/snapshots/$sid.md"
    "$REVEALUI_COORD_LEGACY_CLAUDE/snapshots/$sid.md"
  )
  local p
  for p in "${candidates[@]}"; do
    if [ -f "$p" ]; then
      printf '%s\n' "$p"
      return 0
    fi
  done
  return 1
}

# Path where NEW snapshots must be written (always neutral SSOT).
ss_snapshot_write_path() {
  local sid="${1:-}"
  if [ -z "$sid" ]; then
    sid="$(ss_session_id 2>/dev/null)" || return 1
  fi
  [ -n "$sid" ] || return 1
  ss_ensure_coord_dirs
  printf '%s\n' "$REVEALUI_COORD_ROOT/snapshots/$sid.md"
}

# ---------------------------------------------------------------------------
# Peer / live harness detection (GAP-469)
# PEER LIVE when count of interactive equal-harness processes > 1.
# Patterns are bounded; prefer jv-single-writer-check when available.
# ---------------------------------------------------------------------------

ss_live_harness_peers() {
  local count=0
  local line
  # Interactive-ish agent CLIs. Exclude pipes, greps, and headless -p style.
  while IFS= read -r line; do
    # Skip the scanner itself and any grep/pgrep wrapper line (*grep* also matches pgrep).
    case "$line" in
      *grep*) continue ;;
    esac
    # Skip headless one-shots commonly flagged with " -p " (Claude print mode).
    case "$line" in
      *' -p '*|*' --print'*) continue ;;
    esac
    count=$((count + 1))
  done < <(
    # shellcheck disable=SC2009
    ps -eo args= 2>/dev/null | grep -E \
      '(^|/)(claude|grok|opencode)( |$)|cursor agent|cursor-agent' \
      || true
  )
  printf '%s\n' "$count"
}

# ---------------------------------------------------------------------------
# Repo / daemon helpers
# ---------------------------------------------------------------------------

ss_active_repo() {
  # 1. Explicit crashed-repo env var (set by claude-safe on crash recovery).
  #    Recovery tab is launched from $HOME to avoid direnv/Nix stalls, so PWD
  #    inference below would pick the wrong repo without this hint.
  if [ -n "${REVEALUI_CRASHED_REPO:-}" ] && [ -d "${REVEALUI_CRASHED_REPO:-}" ]; then
    printf '%s\n' "$REVEALUI_CRASHED_REPO"
    return 0
  fi
  # 2. CWD is inside RevFleet — infer the enclosing repo.
  case "$PWD" in
    "$REVFLEET_ROOT"/*) git -C "$PWD" rev-parse --show-toplevel 2>/dev/null && return 0 ;;
  esac
  # 3. Fall back to the canonical primary repo.
  printf '%s\n' "$REVEALUI_REPO"
}

ss_daemon_alive() {
  [ -S "$DAEMON_SOCKET" ] && return 0 || return 1
}

# GAP-342 dual-write helpers (session.snapshot.*). Soft-fail when daemon down.
_ss_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/session-snapshot-daemon.sh
. "$_ss_dir/session-snapshot-daemon.sh"
unset _ss_dir


ss_revvault_alive() {
  command -v revvault >/dev/null 2>&1 || return 1
  revvault list >/dev/null 2>&1
}

ss_workboard_recent() {
  local identity="${1:-}" n="${2:-20}"
  # Validate n is numeric
  [[ "$n" =~ ^[0-9]+$ ]] || { printf 'ss_workboard_recent: n must be numeric, got: %s\n' "$n" >&2; return 1; }
  [ -f "$WORKBOARD" ] || { printf 'workboard missing: %s\n' "$WORKBOARD" >&2; return 1; }
  if [ -n "$identity" ] && [ "$identity" != "stagehand" ]; then
    grep -E "\] ${identity}(-[0-9]+)?:" "$WORKBOARD" | tail -n "$n"
  else
    sed -n '/^## Log/,/^## /p' "$WORKBOARD" | grep -E '^- \[' | head -n "$n"
  fi
}

ss_empty_objects() {
  local repo="${1:-$(ss_active_repo)}"
  find "$repo/.git/objects" -type f -empty 2>/dev/null
}

ss_orphaned_handoffs() {
  # Find handoffs at LEGACY locations that weren't claimed by the receiving
  # session. Scoped intentionally to legacy paths only — canonical-location
  # handoffs at $JV_REPO/docs/HANDOFF-*.md (per the master-handoff.md
  # convention) are discoverable via the workboard `## Log` `[CHECKPOINT]`
  # entries + git history, not filesystem scan. Scanning the canonical
  # location for "orphans" would surface every active <7d handoff as orphaned,
  # which is wrong-by-construction (the sweep keeps them at root for 7 days).
  #
  # Legacy locations scanned below:
  #   /tmp/agent-handoff-*.md     — pre-2026-05-09 ad-hoc handoffs
  #   $JV_REPO/.claude/handoffs/  — deprecated /handoff slash command target
  #                                  (skill `revealui-handoff` v0.3.0+
  #                                  DEPRECATED 2026-05-19; superseded by
  #                                  /checkpoint). Kept for backcompat
  #                                  until next revskills major.
  local age_min="${1:-60}"
  # Validate age_min is numeric
  [[ "$age_min" =~ ^[0-9]+$ ]] || { printf 'ss_orphaned_handoffs: age_min must be numeric, got: %s\n' "$age_min" >&2; return 1; }
  find /tmp -maxdepth 1 -name 'agent-handoff-*.md' -mmin +"$age_min" 2>/dev/null
  find "$JV_REPO/.claude/handoffs" -maxdepth 1 -name '*.md' -mmin +"$age_min" 2>/dev/null
}

ss_hook_state() {
  local ppid="${1:-$PPID}"
  # Validate ppid is numeric
  [[ "$ppid" =~ ^[0-9]+$ ]] || { printf 'ss_hook_state: ppid must be numeric, got: %s\n' "$ppid" >&2; return 1; }
  local out="" f
  # Claude adapter tmp + any revealui-session caches for this ppid.
  for f in \
    "/tmp/claude-agent-edits-${ppid}.json" \
    "/tmp/claude-autocommit-${ppid}.json" \
    "/tmp/claude-context-${ppid}.json" \
    "/tmp/claude-session-${ppid}.json" \
    "/tmp/revealui-session-${ppid}.id" \
    "/tmp/revealui-daemon-session-${ppid}.id"
  do
    if [ -f "$f" ]; then
      out+="$f ($(wc -c <"$f") bytes)\n"
    fi
  done
  printf '%b' "$out"
}
