#!/usr/bin/env bash
# test/coordinate.test.sh — GAP-494 coordinate.js modes.

test_coordinate_report_json_reads_fixtures() {
  local tmp roster claims
  tmp="$(mktemp -d)"
  CLEANUP_DIRS+=("$tmp")
  roster="$tmp/grok"
  claims="$tmp/jv/.revealui/workboard.d/active"
  mkdir -p "$roster" "$claims"
  printf '%s\n' '[{"session_id":"aaa","pid":1,"cwd":"/tmp/a","opened_at":"2026-09-16T00:00:00Z"}]' \
    >"$roster/active_sessions.json"
  printf '%s\n' '| peer | WSL | GAP-1 | 2026-09-16 | stay off: x |' >"$claims/peer.md"

  local out
  out="$(
    env HOME="$tmp" GROK_HOME="$roster" JV_REPO="$tmp/jv" \
      node "$REPO_ROOT/skills/revealui-coordinate/scripts/coordinate.js" \
      --mode=report --json --id aaa
  )"
  assert_contains "report json includes roster sid" '"session_id": "aaa"' "$out"
  assert_contains "report json includes peer claim" '"id": "peer"' "$out"
  assert_contains "report does not write" '"wrote": ""' "$out"
}

test_coordinate_refresh_writes_own_active_row() {
  local tmp claims
  tmp="$(mktemp -d)"
  CLEANUP_DIRS+=("$tmp")
  claims="$tmp/jv/.revealui/workboard.d/active"
  mkdir -p "$tmp/grok" "$claims"
  printf '%s\n' '[]' >"$tmp/grok/active_sessions.json"

  env HOME="$tmp" GROK_HOME="$tmp/grok" JV_REPO="$tmp/jv" \
    node "$REPO_ROOT/skills/revealui-coordinate/scripts/coordinate.js" \
    --mode=refresh --id sess1 --claim 'GAP-494' --stay-off 'revdev' >/dev/null

  local row
  row="$(cat "$claims/sess1.md")"
  assert_contains "refresh wrote session id" "sess1" "$row"
  assert_contains "refresh wrote claim" "GAP-494" "$row"
  assert_contains "refresh wrote stay-off" "revdev" "$row"
}

test_coordinate_bots_is_not_pickup_fence() {
  local tmp out
  tmp="$(mktemp -d)"
  CLEANUP_DIRS+=("$tmp")
  mkdir -p "$tmp/grok" "$tmp/jv/.revealui/workboard.d/active"
  printf '%s\n' '[]' >"$tmp/grok/active_sessions.json"

  out="$(
    env HOME="$tmp" GROK_HOME="$tmp/grok" JV_REPO="$tmp/jv" \
      node "$REPO_ROOT/skills/revealui-coordinate/scripts/coordinate.js" \
      --mode=full --bots --id sess1
  )"
  assert_contains "bots facts header present" "GROK-BOT FACTS" "$out"
  case "$out" in
    *"New session: /pickup"*) fail "bots block must not emit pickup fence" "$out" ;;
    *) pass "bots block is not a pickup fence" ;;
  esac
}
