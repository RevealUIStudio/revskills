#!/usr/bin/env bash
# Tests for scripts/sync-grok-token-budget.js.

SCRIPT="$REPO_ROOT/scripts/sync-grok-token-budget.js"

test_sync_preserves_unrelated_config_and_sets_both_models() {
  local tmp budget cfg out
  tmp="$(make_sandbox)"
  budget="$tmp/token-budget.json"
  cfg="$tmp/config.toml"
  printf '%s\n' '{
    "contextWindowTokens": 500000,
    "compactionAtTokens": 160000,
    "autoCompactThresholdPercent": 99,
    "models": ["grok-4.7", "grok-4.7-build"]
  }' >"$budget"
  printf '%s\n' '# keep me
[session]
load_envrc = true
auto_compact_threshold_percent = 85

[ui]
compact_mode = false

[model."grok-4.7"]
compaction_at_tokens = 1
' >"$cfg"
  out="$(node "$SCRIPT" "$budget" "$cfg")"
  assert_contains "sync reports the derived percent, not the stale JSON percent" "percent=32" "$out"
  local body
  body="$(cat "$cfg")"
  assert_contains "comment survives" "# keep me" "$body"
  assert_contains "unrelated session key survives" "load_envrc = true" "$body"
  assert_contains "percent follows tokens over window" "auto_compact_threshold_percent = 32" "$body"
  assert_contains "ui table survives" "compact_mode = false" "$body"
  assert_contains "existing model tokens updated" 'compaction_at_tokens = 160000' "$body"
  assert_contains "build model section appended" '[model."grok-4.7-build"]' "$body"
  if grep -qE 'compaction_at_tokens = 1([^0-9]|$)' "$cfg"; then
    fail "stale compaction_at_tokens left in place" "$body"
  else
    pass "stale compaction_at_tokens replaced"
  fi
}

test_sync_creates_config_when_missing() {
  local tmp budget cfg
  tmp="$(make_sandbox)"
  budget="$tmp/token-budget.json"
  cfg="$tmp/missing/config.toml"
  printf '%s\n' '{"contextWindowTokens":500000,"compactionAtTokens":160000,"models":["grok-4.7"]}' >"$budget"
  node "$SCRIPT" "$budget" "$cfg" >/dev/null
  assert_contains "new config has the percent" "auto_compact_threshold_percent = 32" "$(cat "$cfg")"
  assert_contains "new config has the model" '[model."grok-4.7"]' "$(cat "$cfg")"
}
