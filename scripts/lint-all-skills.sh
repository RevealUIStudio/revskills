#!/usr/bin/env bash
# Batch-lint every skill under ~/revfleet/revskills/skills/*/SKILL.md using lint-skill.awk,
# and verify every ~/.claude/commands/*.md symlink resolves.
#
# Exit 0 on clean, 1 on any violation. Designed for pre-commit hooks and CI.
#
# Usage:
#   bash ~/revfleet/revskills/scripts/lint-all-skills.sh
#   bash ~/revfleet/revskills/scripts/lint-all-skills.sh --json    # machine-readable output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REVSKILLS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LINTER="$REVSKILLS_ROOT/scripts/lib/lint-skill.awk"
SKILLS_DIR="$REVSKILLS_ROOT/skills"
COMMANDS_DIR="$HOME/.claude/commands"

JSON_MODE=0
[[ "${1:-}" == "--json" ]] && JSON_MODE=1

[[ -f "$LINTER" ]] || { echo "FATAL: linter not found at $LINTER" >&2; exit 2; }
[[ -d "$SKILLS_DIR" ]] || { echo "FATAL: skills dir not found at $SKILLS_DIR" >&2; exit 2; }

declare -a LINT_FAILURES=()
declare -a SYMLINK_FAILURES=()
declare -a FRONTMATTER_FAILURES=()

# 1. Lint every SKILL.md
for skill_file in "$SKILLS_DIR"/*/SKILL.md; do
  [[ -f "$skill_file" ]] || continue
  out=$(awk -f "$LINTER" "$skill_file" 2>&1 || true)
  if [[ -n "$out" ]]; then
    while IFS= read -r line; do
      LINT_FAILURES+=("$skill_file: $line")
    done <<< "$out"
  fi
  # Frontmatter sanity: first line must be ---, must contain name: and description:
  if [[ "$(head -1 "$skill_file")" != "---" ]]; then
    FRONTMATTER_FAILURES+=("$skill_file: missing YAML frontmatter (no leading ---)")
    continue
  fi
  if ! grep -q '^name:' "$skill_file"; then
    FRONTMATTER_FAILURES+=("$skill_file: missing 'name:' field")
  fi
  if ! grep -q '^description:' "$skill_file"; then
    FRONTMATTER_FAILURES+=("$skill_file: missing 'description:' field")
  fi
done

# 2. Verify command symlinks resolve
if [[ -d "$COMMANDS_DIR" ]]; then
  for cmd in "$COMMANDS_DIR"/*.md; do
    [[ -L "$cmd" ]] || continue
    tgt=$(readlink -f "$cmd" 2>/dev/null || true)
    if [[ -z "$tgt" || ! -e "$tgt" ]]; then
      SYMLINK_FAILURES+=("$cmd -> ${tgt:-<unresolvable>}")
    fi
  done
fi

TOTAL=$((${#LINT_FAILURES[@]} + ${#SYMLINK_FAILURES[@]} + ${#FRONTMATTER_FAILURES[@]}))

if (( JSON_MODE )); then
  printf '{"lint_failures":%d,"symlink_failures":%d,"frontmatter_failures":%d,"total":%d}\n' \
    "${#LINT_FAILURES[@]}" "${#SYMLINK_FAILURES[@]}" "${#FRONTMATTER_FAILURES[@]}" "$TOTAL"
else
  if (( TOTAL == 0 )); then
    echo "skills-lint: OK ($(find "$SKILLS_DIR" -maxdepth 2 -name 'SKILL.md' | wc -l) skills clean)"
  else
    echo "skills-lint: $TOTAL violation(s)"
    if (( ${#FRONTMATTER_FAILURES[@]} > 0 )); then
      echo "--- frontmatter ---"
      printf '%s\n' "${FRONTMATTER_FAILURES[@]}"
    fi
    if (( ${#LINT_FAILURES[@]} > 0 )); then
      echo "--- lint ---"
      printf '%s\n' "${LINT_FAILURES[@]}"
    fi
    if (( ${#SYMLINK_FAILURES[@]} > 0 )); then
      echo "--- broken symlinks ---"
      printf '%s\n' "${SYMLINK_FAILURES[@]}"
    fi
  fi
fi

(( TOTAL == 0 )) && exit 0 || exit 1
