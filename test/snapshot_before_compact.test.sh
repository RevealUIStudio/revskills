#!/usr/bin/env bash
# Tests for scripts/snapshot-before-compact.js (snapshot-before-compact gate).

SCRIPT="$REPO_ROOT/scripts/snapshot-before-compact.js"

_sbc() {
  local mode="$1" payload="$2"
  shift 2
  printf '%s\n' "$payload" | env "$@" node "$SCRIPT" --mode="$mode"
}

test_stop_blocks_when_occupancy_above_gate_and_no_snapshot() {
  local tmp sid sess
  tmp="$(make_sandbox)"
  sid="sbc-stop-block-1"
  sess="$tmp/grok/sessions"
  mkdir -p "$sess/dummy/$sid"
  printf '%s\n' '{"contextTokensUsed":400000,"contextWindowTokens":500000,"contextWindowUsage":80}' \
    >"$sess/dummy/$sid/signals.json"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\",\"cwd\":\"$tmp/ws\"}" \
      HOME="$tmp" \
      GROK_HOME="$tmp/grok" \
      REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60
  )"
  assert_contains "stop stdout is a block decision" '"decision":"block"' "$out"
  assert_contains "stop reason names occupancy" "occupancy 80%" "$out"
  assert_contains "stop reason names session id" "$sid" "$out"
}

test_stop_allows_when_occupancy_below_gate() {
  local tmp sid sess
  tmp="$(make_sandbox)"
  sid="sbc-stop-low-1"
  sess="$tmp/grok/sessions/enc"
  mkdir -p "$sess/$sid"
  printf '%s\n' '{"contextTokensUsed":10000,"contextWindowTokens":500000,"contextWindowUsage":2}' \
    >"$sess/$sid/signals.json"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\"}" \
      HOME="$tmp" \
      GROK_HOME="$tmp/grok" \
      REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60 2>&1
  )"
  if [[ "$out" == *'"decision":"block"'* ]]; then
    fail "stop must not block below gate" "$out"
  else
    pass "stop allows occupancy below gate"
  fi
}

test_stop_allows_when_agent_snapshot_exists() {
  local tmp sid sess
  tmp="$(make_sandbox)"
  sid="sbc-stop-has-snap"
  sess="$tmp/grok/sessions/enc"
  mkdir -p "$sess/$sid" "$tmp/coord/snapshots"
  printf '%s\n' '{"contextTokensUsed":400000,"contextWindowTokens":500000,"contextWindowUsage":80}' \
    >"$sess/$sid/signals.json"
  printf '%s\n' "---
session_id: $sid
origin: agent
---
# Snapshot — real
" >"$tmp/coord/snapshots/$sid.md"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\"}" \
      HOME="$tmp" \
      GROK_HOME="$tmp/grok" \
      REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60 2>&1
  )"
  if [[ "$out" == *'"decision":"block"'* ]]; then
    fail "stop must not block when agent snapshot exists" "$out"
  else
    pass "stop allows when agent-authored snapshot exists"
  fi
}

test_stop_blocks_when_only_mechanical_snapshot_exists() {
  local tmp sid sess
  tmp="$(make_sandbox)"
  sid="sbc-stop-mech"
  sess="$tmp/grok/sessions/enc"
  mkdir -p "$sess/$sid" "$tmp/coord/snapshots"
  printf '%s\n' '{"contextTokensUsed":400000,"contextWindowTokens":500000,"contextWindowUsage":80}' \
    >"$sess/$sid/signals.json"
  printf '%s\n' "---
session_id: $sid
origin: precompact-mechanical
---
# mechanical
" >"$tmp/coord/snapshots/$sid.md"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\"}" \
      HOME="$tmp" \
      GROK_HOME="$tmp/grok" \
      REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60
  )"
  assert_contains "mechanical snapshot still Stop-blocks for agent authoring" \
    '"decision":"block"' "$out"
}

test_stop_skips_subagent_and_non_end_turn() {
  local tmp sid
  tmp="$(make_sandbox)"
  sid="sbc-stop-skip"
  mkdir -p "$tmp/grok/sessions/enc/$sid"
  printf '%s\n' '{"contextTokensUsed":400000,"contextWindowTokens":500000}' \
    >"$tmp/grok/sessions/enc/$sid/signals.json"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\",\"subagentType\":\"explore\"}" \
      HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60 2>&1
  )"
  if [[ "$out" == *'"decision":"block"'* ]]; then
    fail "stop must skip subagents" "$out"
  else
    pass "stop skips subagent"
  fi
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"shutdown\"}" \
      HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60 2>&1
  )"
  if [[ "$out" == *'"decision":"block"'* ]]; then
    fail "stop must skip non-end_turn" "$out"
  else
    pass "stop skips reason=shutdown"
  fi
}

test_precompact_writes_mechanical_when_missing() {
  local tmp sid dest
  tmp="$(make_sandbox)"
  sid="sbc-pre-write"
  dest="$tmp/coord/snapshots/$sid.md"
  mkdir -p "$tmp/coord"
  _sbc precompact "{\"hookEventName\":\"PreCompact\",\"sessionId\":\"$sid\",\"trigger\":\"auto\",\"cwd\":\"$tmp\"}" \
    HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" >/dev/null
  if [[ -f "$dest" ]]; then
    pass "precompact writes mechanical snapshot"
  else
    fail "precompact did not write $dest"
    return
  fi
  local body
  body="$(cat "$dest")"
  assert_contains "mechanical origin in frontmatter" "origin: precompact-mechanical" "$body"
  assert_contains "five-section Resume-From-Here present" "## Resume-From-Here" "$body"
  assert_contains "compact trigger recorded" "compact-trigger: auto" "$body"
}

test_precompact_does_not_overwrite_agent_snapshot() {
  local tmp sid dest
  tmp="$(make_sandbox)"
  sid="sbc-pre-keep"
  dest="$tmp/coord/snapshots/$sid.md"
  mkdir -p "$tmp/coord/snapshots"
  printf '%s\n' "---
session_id: $sid
---
# Snapshot — keep me
## Resume-From-Here
agent authored
" >"$dest"
  _sbc precompact "{\"hookEventName\":\"PreCompact\",\"sessionId\":\"$sid\",\"trigger\":\"auto\"}" \
    HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" >/dev/null
  local body
  body="$(cat "$dest")"
  assert_contains "agent snapshot preserved" "agent authored" "$body"
  if [[ "$body" == *"origin: precompact-mechanical"* ]]; then
    fail "precompact overwrote agent snapshot" "$body"
  else
    pass "precompact did not stamp mechanical origin over agent file"
  fi
}

test_precompact_refreshes_existing_mechanical() {
  local tmp sid dest
  tmp="$(make_sandbox)"
  sid="sbc-pre-refresh"
  dest="$tmp/coord/snapshots/$sid.md"
  mkdir -p "$tmp/coord/snapshots"
  printf '%s\n' "---
session_id: $sid
origin: precompact-mechanical
---
# old mechanical
" >"$dest"
  _sbc precompact "{\"hookEventName\":\"PreCompact\",\"sessionId\":\"$sid\",\"trigger\":\"manual\"}" \
    HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" >/dev/null
  local body
  body="$(cat "$dest")"
  assert_contains "mechanical refresh records new trigger" "compact-trigger: manual" "$body"
}

test_stop_blocks_from_chat_history_when_signals_missing() {
  local tmp sid
  tmp="$(make_sandbox)"
  sid="sbc-hist-block"
  mkdir -p "$tmp/grok/sessions/enc/$sid"
  # 2000 bytes / 3 / 1000 window ≈ 67% → above gate 60
  dd if=/dev/zero bs=2000 count=1 status=none of="$tmp/grok/sessions/enc/$sid/chat_history.jsonl"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\"}" \
      HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60 REVEALUI_CONTEXT_WINDOW_TOKENS=1000
  )"
  assert_contains "chat_history fallback Stop-blocks without signals.json" \
    '"decision":"block"' "$out"
}

test_stop_allows_small_chat_history_without_signals() {
  local tmp sid
  tmp="$(make_sandbox)"
  sid="sbc-hist-low"
  mkdir -p "$tmp/grok/sessions/enc/$sid"
  printf 'tiny\n' >"$tmp/grok/sessions/enc/$sid/chat_history.jsonl"
  local out
  out="$(
    _sbc stop "{\"hookEventName\":\"Stop\",\"sessionId\":\"$sid\",\"reason\":\"end_turn\"}" \
      HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" \
      REVEALUI_SNAPSHOT_GATE_PCT=60 REVEALUI_CONTEXT_WINDOW_TOKENS=1000 2>&1
  )"
  if [[ "$out" == *'"decision":"block"'* ]]; then
    fail "small chat_history must not Stop-block" "$out"
  else
    pass "small chat_history without signals allows stop"
  fi
}

test_unknown_mode_fail_open() {
  local tmp
  tmp="$(make_sandbox)"
  assert_exit "unknown mode exits 0" 0 -- \
    env HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" \
    node "$SCRIPT" --mode=nope
}

test_no_session_id_fail_open() {
  local tmp
  tmp="$(make_sandbox)"
  local out
  out="$(
    _sbc precompact "{\"hookEventName\":\"PreCompact\",\"trigger\":\"auto\"}" \
      HOME="$tmp" GROK_HOME="$tmp/grok" REVEALUI_COORD_ROOT="$tmp/coord" 2>&1
  )"
  if ls "$tmp/coord/snapshots"/*.md >/dev/null 2>&1; then
    fail "must not invent a snapshot filename without a session id"
  else
    pass "no session id does not invent a snapshot file"
  fi
  assert_contains "stderr explains skip" "no session id" "$out"
}
