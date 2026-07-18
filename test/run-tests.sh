#!/usr/bin/env bash
# test/run-tests.sh — runs the revskills validator test suite.
#
# Plain bash harness (the repo has no package.json / node dependency to
# build a JS runner on, and the validators under test are bash + awk).
# Each test/*.test.sh file defines test_* functions; this runner sources
# them all, then calls every test_* function it finds, in file order.
#
# Usage:
#   bash test/run-tests.sh

set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TEST_DIR/.." && pwd)"
export REPO_ROOT

# shellcheck source=test/lib/harness.sh
. "$TEST_DIR/lib/harness.sh"

found_any=0
for suite in "$TEST_DIR"/*.test.sh; do
  [[ -f "$suite" ]] || continue
  echo "== $(basename "$suite") =="
  before=$(declare -F | awk '{print $3}' | grep '^test_' | sort || true)
  # shellcheck source=/dev/null
  . "$suite"
  after=$(declare -F | awk '{print $3}' | grep '^test_' | sort || true)
  new_fns=$(comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after"))
  while IFS= read -r fn; do
    [[ -z "$fn" ]] && continue
    found_any=1
    "$fn"
  done <<< "$new_fns"
done

if [[ "$found_any" -eq 0 ]]; then
  echo "no test_* functions found" >&2
  exit 2
fi

echo
echo "== summary =="
echo "$TEST_PASS passed, $TEST_FAIL failed"

(( TEST_FAIL == 0 )) && exit 0 || exit 1
