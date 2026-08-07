#!/usr/bin/env bash
# Batch-lint every skill under skills/*/SKILL.md using lint-skill.awk, and
# verify command/skill symlinks resolve under equal-adapter install dirs.
#
# Exit 0 on clean, 1 on any violation. Designed for pre-commit hooks and CI.
#
# Usage:
#   bash scripts/lint-all-skills.sh
#   bash scripts/lint-all-skills.sh --json
#
# Command dirs (GAP-470): colon-separated REVSKILLS_COMMAND_DIRS, else defaults
# to present equal-adapter roots (~/.claude/commands, ~/.grok/commands when
# those directories exist). Never requires Claude home.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REVSKILLS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LINTER="$REVSKILLS_ROOT/scripts/lib/lint-skill.awk"
SKILLS_DIR="$REVSKILLS_ROOT/skills"

JSON_MODE=0
[[ "${1:-}" == "--json" ]] && JSON_MODE=1

[[ -f "$LINTER" ]] || { echo "FATAL: linter not found at $LINTER" >&2; exit 2; }
[[ -d "$SKILLS_DIR" ]] || { echo "FATAL: skills dir not found at $SKILLS_DIR" >&2; exit 2; }

# Resolve command roots for symlink integrity (optional multi-home).
declare -a COMMAND_DIRS=()
if [[ -n "${REVSKILLS_COMMAND_DIRS:-}" ]]; then
  IFS=':' read -r -a COMMAND_DIRS <<< "$REVSKILLS_COMMAND_DIRS"
else
  for d in \
    "$HOME/.claude/commands" \
    "$HOME/.grok/commands" \
    "$HOME/.cursor/commands"
  do
    [[ -d "$d" ]] && COMMAND_DIRS+=("$d")
  done
fi

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

# 2. Verify command symlinks resolve (any configured adapter home)
for COMMANDS_DIR in "${COMMAND_DIRS[@]:-}"; do
  [[ -d "$COMMANDS_DIR" ]] || continue
  for cmd in "$COMMANDS_DIR"/*; do
    [[ -e "$cmd" || -L "$cmd" ]] || continue
    case "$cmd" in
      *.md|*.MD) ;;
      *) continue ;;
    esac
    [[ -L "$cmd" ]] || continue
    tgt=$(readlink -f "$cmd" 2>/dev/null || true)
    if [[ -z "$tgt" || ! -e "$tgt" ]]; then
      SYMLINK_FAILURES+=("$cmd -> ${tgt:-<unresolvable>}")
    fi
  done
done

TOTAL=$((${#LINT_FAILURES[@]} + ${#SYMLINK_FAILURES[@]} + ${#FRONTMATTER_FAILURES[@]}))

if (( JSON_MODE )); then
  printf '{"lint_failures":%d,"symlink_failures":%d,"frontmatter_failures":%d,"total":%d,"command_dirs":%d}\n' \
    "${#LINT_FAILURES[@]}" "${#SYMLINK_FAILURES[@]}" "${#FRONTMATTER_FAILURES[@]}" "$TOTAL" "${#COMMAND_DIRS[@]}"
else
  if (( TOTAL == 0 )); then
    echo "skills-lint: OK ($(find "$SKILLS_DIR" -maxdepth 2 -name 'SKILL.md' | wc -l) skills clean; ${#COMMAND_DIRS[@]} command dir(s) scanned)"
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
