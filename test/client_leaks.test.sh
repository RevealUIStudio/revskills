#!/usr/bin/env bash
# scripts/check-client-leaks.sh — unconditional client-name scan.
#
# The banned name is assembled from fragments. CI scans this file, so a
# committed literal would fail the client-leak job on its own test.

test_client_leak_flags_bare_name_in_changelog() {
  local sandbox name tag
  sandbox="$(make_sandbox)"
  name="Bio""tix notes"
  printf '%s\n' "$name" >"$sandbox/CHANGELOG.md"
  assert_exit "CHANGELOG is not excluded from the client scan" 1 \
    -- bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$sandbox"
  tag="CLIENT-LEAK:venture-bio""tix-bare"
  assert_contains "bare venture name is tagged" "$tag" "$LAST_OUTPUT"
}
