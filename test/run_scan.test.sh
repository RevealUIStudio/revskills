#!/usr/bin/env bash
# skills/redundancy-scan/scripts/run-scan.js empty fleet.

test_run_scan_empty_fleet_does_not_call_merge() {
  local root out summary
  root="$(make_sandbox)"
  out="$(make_sandbox)/scan"
  assert_exit "empty fleet scan exits 0" 0 \
    -- node "$REPO_ROOT/skills/redundancy-scan/scripts/run-scan.js" \
      --root "$root" --fleet --out-dir "$out"
  summary="$(cat "$out/summary.json")"
  assert_contains "empty fleet summary is recorded" '"emptyFleet": true' "$summary"
}
