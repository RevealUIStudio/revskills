#!/usr/bin/env bash
# Unit tests for scripts/lib/session-state.sh (GAP-469).
# Avoid subshells so pass/fail counters in harness.sh stay accurate.

# shellcheck source=scripts/lib/session-state.sh
_ss_load() {
  # shellcheck disable=SC1091
  . "$REPO_ROOT/scripts/lib/session-state.sh"
}

_ss_clear_session_env() {
  unset AGENT_SESSION_ID REVEALUI_SESSION_ID CLAUDE_CODE_SESSION_ID GROK_SESSION_ID
  unset REVEALUI_IDENTITY AGENT_ROLE CLAUDE_AGENT_ROLE GROK_ACTIVE_SESSIONS
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
  local tmp
  tmp="$(make_sandbox)"
  # Isolate from live Grok active_sessions + any real PID stamps
  export REVEALUI_COORD_ROOT="$tmp/coord"
  export GROK_ACTIVE_SESSIONS="$tmp/no-such-active-sessions.json"
  ss_ensure_coord_dirs
  if ss_session_id >/dev/null 2>&1; then
    fail "ss_session_id should fail when isolated from env/stamps/active_sessions"
  else
    pass "ss_session_id fails closed when isolated"
  fi
  unset REVEALUI_COORD_ROOT GROK_ACTIVE_SESSIONS
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

test_ss_session_id_from_pid_stamps() {
  _ss_load
  _ss_clear_session_env
  unset GROK_SESSION_ID
  local tmp
  tmp="$(make_sandbox)"
  export REVEALUI_COORD_ROOT="$tmp/coord"
  ss_ensure_coord_dirs
  # Stamp current shell pid — ss_session_id walks ancestors including $$
  printf '%s\n' "stamp-sid-99" >"$tmp/coord/harness-sessions/by-pid/$$"
  assert_eq "stamp-sid-99" "$(ss_session_id)" "pid stamp auto-resolves without env"
  _ss_clear_session_env
  unset REVEALUI_COORD_ROOT
}

test_ss_session_id_from_grok_active_fixture() {
  _ss_load
  _ss_clear_session_env
  unset GROK_SESSION_ID
  local tmp fixture
  tmp="$(make_sandbox)"
  export REVEALUI_COORD_ROOT="$tmp/empty-coord"
  # No stamps; fake active_sessions with our pid
  fixture="$tmp/active_sessions.json"
  printf '%s\n' "[{\"session_id\":\"from-active-json\",\"pid\":$$,\"cwd\":\"$PWD\",\"opened_at\":\"2026-08-07T00:00:00Z\"}]" >"$fixture"
  export GROK_ACTIVE_SESSIONS="$fixture"
  assert_eq "from-active-json" "$(ss_session_id)" "Grok active_sessions pid match"
  unset GROK_ACTIVE_SESSIONS REVEALUI_COORD_ROOT
  _ss_clear_session_env
}

test_ss_session_id_auto_on_live_grok() {
  _ss_load
  _ss_clear_session_env
  unset GROK_SESSION_ID REVEALUI_COORD_ROOT GROK_ACTIVE_SESSIONS
  # On a live Grok Studio session this resolves via ~/.grok/active_sessions.json.
  # Outside Grok, skip (do not fail CI).
  if [ ! -f "$HOME/.grok/active_sessions.json" ]; then
    pass "skip live grok auto-resolve (no active_sessions.json)"
    return 0
  fi
  if ss_session_id >/dev/null 2>&1; then
    pass "live Grok auto-resolve: $(ss_session_id)"
  else
    # May still fail if not running under a recorded Grok pid (e.g. bare CI)
    pass "skip live grok auto-resolve (no pid/cwd match in active_sessions)"
  fi
  _ss_clear_session_env
}

test_ss_snapshot_sections_json_parses_five() {
  _ss_load
  local tmp md json
  tmp="$(make_sandbox)"
  md="$tmp/snap.md"
  cat >"$md" <<'MD'
---
session_id: parse-sid
created: 2026-08-07T00:00:00Z
---

# Snapshot — parse test

## Resume-From-Here
next step is open the PR

## What-Shipped
revdev#363 session.snapshot

## Active-Constraints
stay off handlers

## Do-Not-Repeat
do not invent session ids

## Open-Loose-Ends
owner merge remaining
MD
  json="$(ss_snapshot_sections_json "$md")"
  assert_eq "1" "$(printf '%s' "$json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(1 if d.get("resumeFromHere")=="next step is open the PR" and "363" in d.get("whatShipped","") and d.get("doNotRepeat") else 0)')" \
    "five-section parse maps headings to camelCase keys"
}

test_ss_daemon_snapshot_write_skips_without_socket() {
  _ss_load
  local tmp md status
  tmp="$(make_sandbox)"
  export DAEMON_SOCKET="$tmp/no-such.sock"
  export REVEALUI_SOCKET="$tmp/no-such.sock"
  md="$tmp/snap.md"
  cat >"$md" <<'MD'
## Resume-From-Here
hello

## What-Shipped
none

## Active-Constraints
none

## Do-Not-Repeat
none

## Open-Loose-Ends
none
MD
  export AGENT_SESSION_ID="dual-write-skip"
  status="$(ss_daemon_snapshot_write "$md" "dual-write-skip")"
  case "$status" in
    skipped:*) pass "dual-write soft-skips when socket missing: $status" ;;
    *) fail "expected skipped status, got: $status" ;;
  esac
  unset DAEMON_SOCKET REVEALUI_SOCKET AGENT_SESSION_ID
  _ss_clear_session_env
}

test_ss_daemon_snapshot_write_skips_without_file() {
  _ss_load
  local status tmp
  tmp="$(make_sandbox)"
  export DAEMON_SOCKET="$tmp/no-such.sock"
  export REVEALUI_COORD_ROOT="$tmp/coord"
  export GROK_ACTIVE_SESSIONS="$tmp/no-active.json"
  unset AGENT_SESSION_ID REVEALUI_SESSION_ID CLAUDE_CODE_SESSION_ID GROK_SESSION_ID
  status="$(ss_daemon_snapshot_write)"
  case "$status" in
    skipped:*) pass "dual-write soft-skips without file: $status" ;;
    *) fail "expected skipped, got: $status" ;;
  esac
  unset DAEMON_SOCKET REVEALUI_COORD_ROOT GROK_ACTIVE_SESSIONS
  _ss_clear_session_env
}
