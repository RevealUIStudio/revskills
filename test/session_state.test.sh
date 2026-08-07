#!/usr/bin/env bash
# Unit tests for scripts/lib/session-state.sh (GAP-469).
# Avoid subshells so pass/fail counters in harness.sh stay accurate.

# shellcheck source=scripts/lib/session-state.sh
_ss_load() {
  # shellcheck disable=SC1091
  . "$REPO_ROOT/scripts/lib/session-state.sh"
}

_ss_clear_session_env() {
  unset AGENT_SESSION_ID REVEALUI_SESSION_ID CLAUDE_CODE_SESSION_ID
  unset REVEALUI_IDENTITY AGENT_ROLE CLAUDE_AGENT_ROLE
}

test_ss_session_id_prefers_agent_session_id() {
  _ss_load
  _ss_clear_session_env
  export AGENT_SESSION_ID="agent-first"
  export REVEALUI_SESSION_ID="revealui-second"
  export CLAUDE_CODE_SESSION_ID="claude-third"
  assert_eq "agent-first" "$(ss_session_id)" "AGENT_SESSION_ID wins over aliases"
  _ss_clear_session_env
}

test_ss_session_id_falls_through_aliases() {
  _ss_load
  _ss_clear_session_env
  export REVEALUI_SESSION_ID="only-revealui"
  assert_eq "only-revealui" "$(ss_session_id)" "REVEALUI_SESSION_ID when AGENT unset"
  unset REVEALUI_SESSION_ID
  export CLAUDE_CODE_SESSION_ID="claude-only"
  assert_eq "claude-only" "$(ss_session_id)" "CLAUDE_CODE_SESSION_ID last alias"
  _ss_clear_session_env
}

test_ss_session_id_empty_without_env() {
  _ss_load
  _ss_clear_session_env
  if ss_session_id >/dev/null 2>&1; then
    fail "ss_session_id should fail when no session env is set"
  else
    pass "ss_session_id fails closed with no env"
  fi
}

test_ss_identity_prefers_neutral() {
  _ss_load
  _ss_clear_session_env
  export REVEALUI_IDENTITY="from-revealui"
  export AGENT_ROLE="from-agent-role"
  export CLAUDE_AGENT_ROLE="from-claude"
  assert_eq "from-revealui" "$(ss_identity)" "REVEALUI_IDENTITY wins"
  unset REVEALUI_IDENTITY
  assert_eq "from-agent-role" "$(ss_identity)" "AGENT_ROLE before CLAUDE_AGENT_ROLE"
  _ss_clear_session_env
}

test_ss_snapshot_write_and_resolve() {
  _ss_load
  local tmp write_path got
  tmp="$(make_sandbox)"
  export REVEALUI_COORD_ROOT="$tmp/coord"
  export REVEALUI_COORD_LEGACY_CLAUDE="$tmp/legacy"
  export AGENT_SESSION_ID="sid-test-1"
  write_path="$(ss_snapshot_write_path)"
  assert_eq "$tmp/coord/snapshots/sid-test-1.md" "$write_path" "write path is neutral SSOT"
  printf '# snap\n' >"$write_path"
  got="$(ss_snapshot_path)"
  assert_eq "$write_path" "$got" "resolve finds neutral snapshot"
  _ss_clear_session_env
  unset REVEALUI_COORD_ROOT REVEALUI_COORD_LEGACY_CLAUDE
}

test_ss_snapshot_legacy_read_through() {
  _ss_load
  local tmp got
  tmp="$(make_sandbox)"
  export REVEALUI_COORD_ROOT="$tmp/coord"
  export REVEALUI_COORD_LEGACY_CLAUDE="$tmp/legacy"
  export AGENT_SESSION_ID="legacy-sid"
  mkdir -p "$tmp/legacy/snapshots"
  printf '# legacy\n' >"$tmp/legacy/snapshots/legacy-sid.md"
  got="$(ss_snapshot_path)"
  assert_eq "$tmp/legacy/snapshots/legacy-sid.md" "$got" "read-through legacy Claude path"
  _ss_clear_session_env
  unset REVEALUI_COORD_ROOT REVEALUI_COORD_LEGACY_CLAUDE
}

test_ss_live_harness_peers_is_numeric() {
  _ss_load
  local n
  n="$(ss_live_harness_peers)"
  if [[ "$n" =~ ^[0-9]+$ ]]; then
    pass "ss_live_harness_peers returns non-negative integer ($n)"
  else
    fail "ss_live_harness_peers not numeric: $n"
  fi
}

test_ss_coord_paths() {
  _ss_load
  local tmp
  tmp="$(make_sandbox)"
  export REVEALUI_COORD_ROOT="$tmp/coord"
  assert_eq "$tmp/coord" "$(ss_coord_root)" "coord root"
  assert_eq "$tmp/coord/snapshots" "$(ss_snap_dir)" "snap dir"
  assert_eq "$tmp/coord/snapshots/archive" "$(ss_snap_archive_dir)" "archive dir"
  ss_ensure_coord_dirs
  if [ -d "$tmp/coord/snapshots/archive" ]; then
    pass "ss_ensure_coord_dirs created neutral tree"
  else
    fail "ensure_coord_dirs did not create archive"
  fi
  unset REVEALUI_COORD_ROOT
}
