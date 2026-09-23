#!/usr/bin/env bash
# Tests for scripts/cap-tool-output.js.

SCRIPT="$REPO_ROOT/scripts/cap-tool-output.js"

_cap() {
  local payload="$1"
  shift
  printf '%s\n' "$payload" | env "$@" node "$SCRIPT"
}

test_cap_leaves_short_shell_output() {
  local out
  out="$(_cap '{"hookEventName":"post_tool_use","toolName":"run_terminal_command","toolResult":{"type":"Bash","output_for_prompt":"ok"}}')"
  if [[ -n "$out" ]]; then
    fail "short shell output must not be replaced" "$out"
  else
    pass "short shell output is left alone"
  fi
}

test_cap_clips_long_grep_output_and_keeps_ends() {
  local payload out head tail
  head="$(printf 'H%.0s' {1..20})"
  tail="$(printf 'T%.0s' {1..20})"
  payload="$(python3 - "$head" "$tail" <<'PY'
import json, sys
head, tail = sys.argv[1], sys.argv[2]
middle = "M" * 80
print(json.dumps({
  "hookEventName": "post_tool_use",
  "toolName": "grep",
  "toolResult": {"type": "Grep", "output_for_prompt": head + middle + tail},
}))
PY
)"
  out="$(
    _cap "$payload" \
      REVEALUI_TOOL_OUTPUT_CAP=40 \
      REVEALUI_TOOL_OUTPUT_HEAD=20 \
      REVEALUI_TOOL_OUTPUT_TAIL=20
  )"
  assert_contains "replacement is PostToolUse updatedToolOutput" "updatedToolOutput" "$out"
  assert_contains "head of the grep output survives" "$head" "$out"
  assert_contains "tail of the grep output survives" "$tail" "$out"
  assert_contains "middle is marked omitted" "cap-tool-output: omitted" "$out"
  if [[ "$out" == *"MMMMMMMM"* ]]; then
    fail "middle of the grep output was stored" "$out"
  else
    pass "middle of the grep output was not stored"
  fi
}

test_cap_ignores_read_file() {
  local payload out
  payload="$(python3 - <<'PY'
import json
print(json.dumps({
  "hookEventName": "post_tool_use",
  "toolName": "read_file",
  "toolResult": {"type": "Read", "output_for_prompt": "X" * 200},
}))
PY
)"
  out="$(_cap "$payload" REVEALUI_TOOL_OUTPUT_CAP=40 REVEALUI_TOOL_OUTPUT_HEAD=10 REVEALUI_TOOL_OUTPUT_TAIL=10)"
  if [[ -n "$out" ]]; then
    fail "read_file must not be capped" "$out"
  else
    pass "read_file is left intact"
  fi
}

test_cap_skips_already_truncated_payload() {
  local out
  out="$(_cap '{"hookEventName":"post_tool_use","toolName":"grep","toolResultTruncated":true,"toolResult":"not-an-object"}')"
  if [[ -n "$out" ]]; then
    fail "already-truncated result must not be replaced" "$out"
  else
    pass "already-truncated result is left alone"
  fi
}
