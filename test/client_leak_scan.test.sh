#!/usr/bin/env bash
# test/client_leak_scan.test.sh: scripts/check-client-leaks.sh
#
# Patterns load from CLIENT_LEAK_PATTERNS, or from a gitignored local file
# when not in CI. Placeholder literals are assembled at runtime so this
# tracked file does not itself contain a scan target.

WATCH="$REPO_ROOT/.client-name-watchlist.local"

placeholder_line() {
  local lit
  lit="acme-""placeholder"
  printf 'example-tag|%s|example' "$lit"
}

stash_watch() {
  WATCH_BACKUP=""
  if [[ -f "$WATCH" ]]; then
    WATCH_BACKUP="$(mktemp)"
    mv "$WATCH" "$WATCH_BACKUP"
  fi
}

restore_watch() {
  if [[ -n "${WATCH_BACKUP:-}" && -f "$WATCH_BACKUP" ]]; then
    mv "$WATCH_BACKUP" "$WATCH"
  else
    rm -f "$WATCH"
  fi
  WATCH_BACKUP=""
}

test_client_leak_placeholder_clean_tree() {
  assert_exit "placeholder patterns accept this tree" 0 \
    -- env CLIENT_LEAK_PATTERNS="$(placeholder_line)" bash "$REPO_ROOT/scripts/check-client-leaks.sh"
}

test_client_leak_flags_placeholder_hit() {
  local sandbox lit
  sandbox="$(make_sandbox)"
  lit="acme-""placeholder"
  printf 'see %s in the draft\n' "$lit" > "$sandbox/notes.md"
  assert_exit "placeholder literal is a violation" 1 \
    -- env CLIENT_LEAK_PATTERNS="$(placeholder_line)" bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$sandbox"
  assert_contains "failure output tags the finding" \
    "CLIENT-LEAK:example-tag" "$LAST_OUTPUT"
}

test_client_leak_ci_empty_fails_closed() {
  local sandbox
  sandbox="$(make_sandbox)"
  printf 'clean\n' > "$sandbox/notes.md"
  assert_exit "CI without the secret fails closed" 2 \
    -- env -u CLIENT_LEAK_PATTERNS CI=true GITHUB_ACTIONS=true bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$sandbox"
  assert_contains "CI error names the secret" \
    "CLIENT_LEAK_PATTERNS" "$LAST_OUTPUT"
}

test_client_leak_local_missing_warns() {
  local out
  stash_watch
  assert_exit "local run with no pattern source exits 2" 2 \
    -- env -u CLIENT_LEAK_PATTERNS -u CI -u GITHUB_ACTIONS bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$REPO_ROOT/scripts/check-client-leaks.sh"
  out="$LAST_OUTPUT"
  restore_watch
  assert_contains "local miss prints a warning" "warning" "$out"
}

test_client_leak_local_file_fallback() {
  local sandbox
  sandbox="$(make_sandbox)"
  printf 'clean notes\n' > "$sandbox/notes.md"
  stash_watch
  printf '%s\n' "$(placeholder_line)" > "$WATCH"
  assert_exit "gitignored watchlist is a local pattern source" 0 \
    -- env -u CLIENT_LEAK_PATTERNS -u CI -u GITHUB_ACTIONS bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$sandbox"
  assert_exit "watchlist file is excluded from the scan" 0 \
    -- env -u CLIENT_LEAK_PATTERNS -u CI -u GITHUB_ACTIONS bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$REPO_ROOT"
  restore_watch
}

test_client_leak_rejects_malformed_line() {
  assert_exit "malformed pattern line fails closed" 2 \
    -- env CLIENT_LEAK_PATTERNS='not-a-pattern' bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$REPO_ROOT/scripts/check-client-leaks.sh"
}

test_client_leak_rejects_empty_literal() {
  assert_exit "empty literal fails closed" 2 \
    -- env CLIENT_LEAK_PATTERNS='example-tag||example' bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$REPO_ROOT/scripts/check-client-leaks.sh"
}

test_client_leak_ci_ignores_local_file() {
  stash_watch
  printf '%s\n' "$(placeholder_line)" > "$WATCH"
  assert_exit "CI does not fall back to the local file" 2 \
    -- env -u CLIENT_LEAK_PATTERNS CI=true bash "$REPO_ROOT/scripts/check-client-leaks.sh" "$REPO_ROOT/scripts/check-client-leaks.sh"
  assert_contains "CI still names the secret" \
    "CLIENT_LEAK_PATTERNS" "$LAST_OUTPUT"
  restore_watch
}
