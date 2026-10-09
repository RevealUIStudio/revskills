#!/usr/bin/env bash
# bin/claude-safe snapshot selection.

test_claude_safe_ignores_other_session_snapshot() {
  local tmp decoy marker snap
  tmp="$(make_sandbox)"
  decoy="/tmp/claude-last-state-0-audit-decoy.json"
  printf '%s\n' '{"other":true}' >"$decoy"
  assert_exit "simulate-crash exits with the requested code" 42 \
    -- env TMPDIR="$tmp" bash "$REPO_ROOT/bin/claude-safe" --simulate-crash 42
  marker="$(find "$tmp" -name 'claude-crash-*.json' | head -1)"
  snap="$(node -e 'const fs=require("fs"); const raw=fs.readFileSync(process.argv[1],"utf8"); const j=JSON.parse(raw); process.stdout.write(String(j.snapshot||j.snapshot_b64||""));' "$marker")"
  rm -f "$decoy"
  if [[ -z "$snap" || "$snap" == "$decoy" ]]; then
    if [[ "$snap" == "$decoy" ]]; then
      fail "crash marker attached another session snapshot" "$snap"
    else
      pass "crash marker did not attach another session snapshot"
    fi
  else
    fail "crash marker snapshot is unexpected" "$snap"
  fi
}
