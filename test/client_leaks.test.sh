#!/usr/bin/env bash
# scripts/check-client-leaks.sh — unconditional client-name scan.

test_client_leak_flags_bare_biotix_in_changelog() {
  local sandbox
  sandbox="$(make_sandbox)"
  printf '%s\n' 'Biotix notes' >"$sandbox/CHANGELOG.md"
  assert_exit "CHANGELOG is not excluded from the client scan" 1 \
    -- bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$sandbox"
  assert_contains "bare Biotix is tagged" "CLIENT-LEAK:venture-biotix-bare" "$LAST_OUTPUT"
}
