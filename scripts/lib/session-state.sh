#!/usr/bin/env bash
# Shared session-state helpers for continuity skills (/recover, /handoff, /doctor).
# Source this file: . ~/.claude/scripts/lib/session-state.sh

REVFLEET_ROOT="${REVFLEET_ROOT:-$HOME/revfleet}"
REVEALUI_REPO="${REVEALUI_REPO:-$REVFLEET_ROOT/revealui}"
JV_REPO="${JV_REPO:-$REVFLEET_ROOT/.jv}"
WORKBOARD="${WORKBOARD:-$JV_REPO/.claude/workboard.md}"
DAEMON_SOCKET="${REVEALUI_SOCKET:-${DAEMON_SOCKET:-$HOME/.local/share/revealui/harness.sock}}"

ss_identity() {
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
  # convention) are discoverable via the workboard `## Log` `[PRE-ARCHIVE]`
  # entries + git history, not filesystem scan. Scanning the canonical
  # location for "orphans" would surface every active handoff <7d as orphaned,
  # which is wrong-by-construction (the sweep keeps them at root for 7 days).
  #
  # Legacy locations scanned below:
  #   /tmp/agent-handoff-*.md     — pre-2026-05-09 ad-hoc handoffs
  #   $JV_REPO/.claude/handoffs/  — deprecated /handoff slash command target
  #                                  (skill `revealui-handoff` v0.3.0+
  #                                  DEPRECATED 2026-05-19; superseded by
  #                                  /prepare-archive). Kept for backcompat
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
  local out=""
  for f in "/tmp/claude-agent-edits-${ppid}.json" "/tmp/claude-autocommit-${ppid}.json" "/tmp/claude-context-${ppid}.json" "/tmp/claude-session-${ppid}.json"; do
    if [ -f "$f" ]; then
      out+="$f ($(wc -c <"$f") bytes)\n"
    fi
  done
  printf '%b' "$out"
}
