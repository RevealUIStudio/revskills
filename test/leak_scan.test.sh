#!/usr/bin/env bash
# test/leak_scan.test.sh — tests for scripts/check-no-private-leaks.sh.
#
# What it checks (grounded in scripts/check-no-private-leaks.sh): the
# scanned path tree must contain none of a fixed pattern list — absolute
# /home/<user> paths, absolute Windows/WSL user paths, the private .jv
# repo path or name, LTS/Forge drive mounts, the devbox hostname,
# RevealUI license key shapes, and Vercel org/project id shapes.
#
# Like the plugin-lint fixtures, the bad case here is generated at test
# time into a mktemp sandbox instead of committed under test/fixtures/:
# CI's existing "private-leak-scan" job scans the whole checked out repo
# by default, so a committed file containing a private-path-shaped string
# would make that corpus-wide job fail on purpose-built bad content.

test_leak_scan_flags_private_home_path() {
  local sandbox bad_path
  sandbox="$(make_sandbox)"
  # Built from fragments, not a literal "/home/<user>" string: CI's
  # existing "private-leak-scan" job scans this whole repo, and a
  # committed source file containing that literal substring would trip
  # it on its own test code. See check-no-private-leaks.sh's own
  # "devbox-host" pattern for the same split-string precedent.
  bad_path="/ho""me/exampleuser/notes.txt"
  printf 'see %s for the draft\n' "$bad_path" > "$sandbox/notes.md"
  assert_exit "leak-scan rejects an absolute /home/<user> path" 1 \
    -- bash "$REPO_ROOT/scripts/check-no-private-leaks.sh" "$sandbox"
  assert_contains "failure output tags the finding" \
    "LEAK:abs-home-path" "$LAST_OUTPUT"
}

test_leak_scan_accepts_clean_content() {
  local sandbox
  sandbox="$(make_sandbox)"
  printf 'no private paths in this file, just prose\n' > "$sandbox/notes.md"
  assert_exit "leak-scan accepts content with no private paths" 0 \
    -- bash "$REPO_ROOT/scripts/check-no-private-leaks.sh" "$sandbox"
}
