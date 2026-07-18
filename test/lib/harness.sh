#!/usr/bin/env bash
# test/lib/harness.sh — shared assertions and sandbox helpers for the
# revskills validator test suite. Sourced by test/run-tests.sh and every
# test/*.test.sh file. Plain bash, no external test framework: the repo
# has no package.json and no existing JS/node dependency to build on, and
# the validators themselves are bash + awk.

set -uo pipefail

TEST_PASS=0
TEST_FAIL=0
declare -a CLEANUP_DIRS=()

pass() {
  TEST_PASS=$((TEST_PASS + 1))
  printf '  ok   %s\n' "$1"
}

fail() {
  TEST_FAIL=$((TEST_FAIL + 1))
  printf '  FAIL %s\n' "$1"
  if [[ -n "${2:-}" ]]; then
    printf '%s\n' "$2" | sed 's/^/       /'
  fi
}

# assert_exit <description> <expected_code> -- <command...>
assert_exit() {
  local desc="$1" expected="$2"
  shift 2
  [[ "${1:-}" == "--" ]] && shift
  local out actual
  out="$("$@" 2>&1)"
  actual=$?
  if [[ "$actual" -eq "$expected" ]]; then
    pass "$desc"
  else
    fail "$desc" "expected exit $expected, got $actual. output:
$out"
  fi
  # shellcheck disable=SC2034  # read by callers in test/*.test.sh after sourcing
  LAST_OUTPUT="$out"
}

# assert_contains <description> <needle> <haystack>
assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    pass "$desc"
  else
    fail "$desc" "expected to find '$needle' in:
$haystack"
  fi
}

# make_sandbox — create a tracked temp dir, auto-removed by cleanup_sandboxes.
make_sandbox() {
  local dir
  dir="$(mktemp -d "${TMPDIR:-/tmp}/revskills-test.XXXXXX")"
  CLEANUP_DIRS+=("$dir")
  printf '%s\n' "$dir"
}

cleanup_sandboxes() {
  local d
  for d in "${CLEANUP_DIRS[@]:-}"; do
    [[ -n "$d" && -d "$d" ]] && rm -rf "$d"
  done
  CLEANUP_DIRS=()
}
trap cleanup_sandboxes EXIT

# make_isolated_skills_lint_env <fixture-name...>
# Copies scripts/lint-all-skills.sh + scripts/lib/lint-skill.awk into a
# fresh sandbox at scripts/, then copies each named fixture from
# test/fixtures/skills/<name> into <sandbox>/skills/<name>. Because
# lint-all-skills.sh derives REVSKILLS_ROOT from its own location
# (BASH_SOURCE), running the copy in isolation points SKILLS_DIR at the
# sandbox's skills/ dir, not the repo's real skills/ dir — no fixture
# ever touches the real corpus.
make_isolated_skills_lint_env() {
  local sandbox
  sandbox="$(make_sandbox)"
  mkdir -p "$sandbox/scripts/lib" "$sandbox/skills"
  cp "$REPO_ROOT/scripts/lint-all-skills.sh" "$sandbox/scripts/lint-all-skills.sh"
  cp "$REPO_ROOT/scripts/lib/lint-skill.awk" "$sandbox/scripts/lib/lint-skill.awk"
  local name
  for name in "$@"; do
    cp -R "$REPO_ROOT/test/fixtures/skills/$name" "$sandbox/skills/$name"
  done
  printf '%s\n' "$sandbox"
}

# make_isolated_home_with_commands <fixture-command-file...>
# Builds a fake $HOME that reproduces the committed test/fixtures/commands/
# symlinks (copied with cp -P, so the exact committed symlink target string
# is reused) plus a sibling .claude/skills/ tree so the "../skills/..."
# relative targets resolve exactly as they do in test/fixtures/. The
# missing-skill target for broken-ref.md is deliberately never created, so
# the symlink stays dangling. Used with the real, unmodified
# lint-all-skills.sh (HOME=<fake> bash scripts/lint-all-skills.sh) to
# exercise its command-symlink integrity check without touching the
# developer's real ~/.claude/commands.
make_isolated_home_with_commands() {
  local fake_home
  fake_home="$(make_sandbox)"
  mkdir -p "$fake_home/.claude/commands" "$fake_home/.claude/skills"
  cp -R "$REPO_ROOT/test/fixtures/skills/good-skill" "$fake_home/.claude/skills/good-skill"
  local name
  for name in "$@"; do
    cp -P "$REPO_ROOT/test/fixtures/commands/$name" "$fake_home/.claude/commands/$name"
  done
  printf '%s\n' "$fake_home"
}
