#!/usr/bin/env bash
# Shared session-state helpers for continuity skills (/recover, /handoff, /doctor).
# Source this file: . ~/.claude/scripts/lib/session-state.sh

SUITE_ROOT="${SUITE_ROOT:-$HOME/suite}"
REVEALUI_REPO="${REVEALUI_REPO:-$SUITE_ROOT/revealui}"
JV_REPO="${JV_REPO:-$SUITE_ROOT/.jv}"
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
  case "$PWD" in
    "$SUITE_ROOT"/*) git -C "$PWD" rev-parse --show-toplevel 2>/dev/null && return 0 ;;
  esac
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
  local age_min="${1:-60}"
  find /tmp -maxdepth 1 -name 'agent-handoff-*.md' -mmin +"$age_min" 2>/dev/null
  find "$JV_REPO/.claude/handoffs" -maxdepth 1 -name '*.md' -mmin +"$age_min" 2>/dev/null
}

ss_hook_state() {
  local ppid="${1:-$PPID}"
  local out=""
  for f in "/tmp/claude-agent-edits-${ppid}.json" "/tmp/claude-autocommit-${ppid}.json" "/tmp/claude-context-${ppid}.json" "/tmp/claude-session-${ppid}.json"; do
    if [ -f "$f" ]; then
      out+="$f ($(wc -c <"$f") bytes)\n"
    fi
  done
  printf '%b' "$out"
}
