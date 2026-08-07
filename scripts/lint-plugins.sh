#!/usr/bin/env bash
# lint-plugins.sh
#
# Validates plugin trees (Agent Skills packaging). Prefers the repo under
# test; Claude Code's ~/.claude/plugins/cache is one optional adapter cache.
#
# Catches structural and security issues before they reach a session:
#   - missing or malformed plugin.json
#   - unpinned versions (should be semver or commit hash)
#   - shell scripts with predictable /tmp paths, inline `node -e`,
#     unquoted eval, or `rm -rf $X` patterns
#   - SKILL.md files without frontmatter (name/description)
#
# Exit 0 on clean, 1 on any FAIL. Designed for pre-push hooks and CI.
#
# Usage:
#   bash scripts/lint-plugins.sh                 # repo root if .claude-plugin exists, else Claude cache
#   bash scripts/lint-plugins.sh .               # lint this checkout (CI)
#   bash scripts/lint-plugins.sh <plugin-dir>    # lint explicit dir
#   PLUGIN_LINT_JSON=1 bash scripts/lint-plugins.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# GAP-470: default to repo root when it carries plugin metadata so pre-push
# does not require a Claude plugin cache. Explicit arg still wins.
if [[ -n "${1:-}" ]]; then
  CACHE_ROOT="$1"
elif [[ -d "$REPO_ROOT/.claude-plugin" ]]; then
  CACHE_ROOT="$REPO_ROOT"
elif [[ -d "$HOME/.claude/plugins/cache" ]]; then
  CACHE_ROOT="$HOME/.claude/plugins/cache"
else
  echo "[plugin-lint] error: no plugin root (pass a path, or keep .claude-plugin/ in-repo)" >&2
  exit 2
fi
if [[ ! -d "$CACHE_ROOT" ]]; then
  echo "[plugin-lint] error: no plugin root at $CACHE_ROOT" >&2
  exit 2
fi

declare -a FAILURES=()
declare -a WARNINGS=()
PLUGIN_COUNT=0

# --- Load .pluginlintignore (optional) ---
#
# Format: <plugin-glob> <issue-substring>   # reason
# Suppresses failures whose plugin_id matches the glob AND whose message
# contains the issue-substring. Used to park known upstream bugs in
# third-party plugins without making them invisible.
IGNORE_FILE="$REPO_ROOT/.pluginlintignore"
declare -a P_IGN_GLOBS=()
declare -a P_IGN_SUBSTRS=()
if [[ -f "$IGNORE_FILE" ]]; then
  while IFS= read -r raw; do
    line="${raw%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    glob="${line%%[[:space:]]*}"
    substr="${line#*[[:space:]]}"
    substr="${substr#"${substr%%[![:space:]]*}"}"
    [[ -z "$substr" || "$substr" = "$glob" ]] && continue
    P_IGN_GLOBS+=("$glob")
    P_IGN_SUBSTRS+=("$substr")
  done < "$IGNORE_FILE"
fi

is_plugin_ignored() {
  local plugin_id="$1" message="$2" i glob substr
  for i in "${!P_IGN_GLOBS[@]}"; do
    glob="${P_IGN_GLOBS[$i]}"
    substr="${P_IGN_SUBSTRS[$i]}"
    # shellcheck disable=SC2053
    if [[ "$plugin_id" == $glob && "$message" == *"$substr"* ]]; then
      return 0
    fi
  done
  return 1
}

filter_suppressions() {
  local -n arr=$1  # nameref
  local plugin_id_and_msg new=()
  for plugin_id_and_msg in "${arr[@]}"; do
    local pid="${plugin_id_and_msg%%:*}"
    if ! is_plugin_ignored "$pid" "$plugin_id_and_msg"; then
      new+=("$plugin_id_and_msg")
    fi
  done
  arr=("${new[@]}")
}

# --- plugin.json validation ---
require_field() {
  local file="$1" field="$2" plugin_id="$3"
  if ! grep -qE "\"$field\"\\s*:" -- "$file"; then
    FAILURES+=("$plugin_id: missing required field '$field' in $file")
    return 1
  fi
  return 0
}

validate_version() {
  local version="$1" plugin_id="$2"
  # Accept: semver (0.1.0, 1.2.3-beta.1), commit hash (7-40 hex chars).
  if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    return 0
  fi
  if [[ "$version" =~ ^[a-f0-9]{7,40}$ ]]; then
    return 0
  fi
  WARNINGS+=("$plugin_id: version '$version' is neither semver nor commit hash — pin it")
  return 1
}

# --- shell script security scan ---
scan_shell_script() {
  local file="$1" plugin_id="$2"
  local rel="${file#$CACHE_ROOT/}"

  # Skip test files — they're not executed in normal plugin operation.
  case "$rel" in
    */tests/*|*/__tests__/*|*/test/*|*.test.sh|*.spec.sh) return 0 ;;
  esac

  # Inline node -e — violates hooks.md rule, hard to audit, escaping hell.
  if grep -nE '\bnode\s+-e\s+["'\'']' -- "$file" >/dev/null 2>&1; then
    FAILURES+=("$plugin_id: $rel contains inline 'node -e' (rule: hooks.md)")
  fi

  # Predictable /tmp paths — symlink-overwrite risk.
  # Flag /tmp/<name>-$$.<ext> or /tmp/<name>-<date-invocation>.<ext>.
  if grep -nE '/tmp/[a-zA-Z0-9_-]+-(\$\$|\$\(date)' -- "$file" >/dev/null 2>&1; then
    WARNINGS+=("$plugin_id: $rel uses predictable /tmp paths — prefer mktemp + chmod 600")
  fi

  # Unquoted eval of variables — command injection.
  if grep -nE '\beval\s+\$[A-Za-z_]' -- "$file" >/dev/null 2>&1; then
    FAILURES+=("$plugin_id: $rel contains unquoted 'eval \$VAR' — command injection risk")
  fi

  # rm -rf $VAR without quotes — pathological word splitting.
  if grep -nE '\brm\s+-rf?\s+\$[A-Za-z_]' -- "$file" >/dev/null 2>&1; then
    FAILURES+=("$plugin_id: $rel contains unquoted 'rm -rf \$VAR' — word-splitting risk")
  fi

  # curl | bash / wget | sh — supply-chain risk.
  if grep -nE 'curl[^|]*\|\s*(bash|sh)\b|wget[^|]*\|\s*(bash|sh)\b' -- "$file" >/dev/null 2>&1; then
    FAILURES+=("$plugin_id: $rel contains 'curl | bash' — supply-chain risk")
  fi
}

# --- SKILL.md frontmatter validation ---
validate_skill_md() {
  local file="$1" plugin_id="$2"
  local rel="${file#$CACHE_ROOT/}"

  if [[ "$(head -1 "$file")" != "---" ]]; then
    FAILURES+=("$plugin_id: $rel missing YAML frontmatter")
    return
  fi
  if ! grep -qE '^name:' -- "$file"; then
    FAILURES+=("$plugin_id: $rel missing 'name:' in frontmatter")
  fi
  if ! grep -qE '^description:' -- "$file"; then
    FAILURES+=("$plugin_id: $rel missing 'description:' in frontmatter")
  fi
}

# --- Iterate every cached plugin version ---
while IFS= read -r manifest; do
  plugin_dir="$(dirname "$(dirname "$manifest")")"
  plugin_id="${plugin_dir#"$CACHE_ROOT"/}"
  # When linting a plugin whose root *is* CACHE_ROOT (repo checkout, or `.`),
  # prefix strip leaves the full path or `.` / empty — .pluginlintignore globs
  # need the manifest "name". Fall back so suppressions stay stable (GAP-470).
  if [[ "$plugin_id" == "." || -z "$plugin_id" || "$plugin_id" == "$plugin_dir" ]]; then
    manifest_name="$(grep -E '"name"\s*:' "$manifest" | head -1 | sed -E 's/.*"name"\s*:\s*"([^"]+)".*/\1/')"
    [[ -n "$manifest_name" ]] && plugin_id="$manifest_name"
  fi
  PLUGIN_COUNT=$((PLUGIN_COUNT+1))

  # Required fields.
  require_field "$manifest" "name" "$plugin_id" || true
  require_field "$manifest" "description" "$plugin_id" || true

  # Version field: either plugin.json declares it OR the containing dir
  # name is a semver / commit hash (Anthropic-official plugins do the
  # latter — the dir hash IS the pin).
  version=$(grep -E '"version"\s*:' "$manifest" | head -1 | sed -E 's/.*"version"\s*:\s*"([^"]+)".*/\1/')
  if [[ -n "$version" ]]; then
    validate_version "$version" "$plugin_id"
  else
    dir_version="$(basename "$plugin_dir")"
    if [[ "$dir_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]] || \
       [[ "$dir_version" =~ ^[a-f0-9]{7,40}$ ]]; then
      :  # directory name serves as the pin — accept
    else
      FAILURES+=("$plugin_id: no 'version' in plugin.json and dir '$dir_version' isn't semver or commit hash")
    fi
  fi

  # Scan shell scripts in the plugin.
  while IFS= read -r sh; do
    [[ -f "$sh" ]] && scan_shell_script "$sh" "$plugin_id"
  done < <(find "$plugin_dir" -type f -name '*.sh' 2>/dev/null)

  # Validate SKILL.md files.
  while IFS= read -r skill; do
    [[ -f "$skill" ]] && validate_skill_md "$skill" "$plugin_id"
  done < <(find "$plugin_dir" -type f -name 'SKILL.md' 2>/dev/null)

done < <(find "$CACHE_ROOT" -type f -path '*/.claude-plugin/plugin.json' 2>/dev/null)

# --- Apply .pluginlintignore suppressions ---
if (( ${#P_IGN_GLOBS[@]} > 0 )); then
  [[ ${#FAILURES[@]} -gt 0 ]] && filter_suppressions FAILURES
  [[ ${#WARNINGS[@]} -gt 0 ]] && filter_suppressions WARNINGS
fi

# --- Report ---
TOTAL_FAIL=${#FAILURES[@]}
TOTAL_WARN=${#WARNINGS[@]}

if [[ -n "${PLUGIN_LINT_JSON:-}" ]]; then
  printf '{"plugins":%d,"failures":%d,"warnings":%d}\n' "$PLUGIN_COUNT" "$TOTAL_FAIL" "$TOTAL_WARN"
else
  if (( TOTAL_FAIL == 0 && TOTAL_WARN == 0 )); then
    echo "[plugin-lint] OK — $PLUGIN_COUNT plugin version(s) clean"
  else
    echo "[plugin-lint] $PLUGIN_COUNT plugin version(s) scanned; $TOTAL_FAIL fail, $TOTAL_WARN warn"
    if (( TOTAL_FAIL > 0 )); then
      echo "--- FAIL ---"
      printf '  %s\n' "${FAILURES[@]}"
    fi
    if (( TOTAL_WARN > 0 )); then
      echo "--- WARN ---"
      printf '  %s\n' "${WARNINGS[@]}"
    fi
  fi
fi

(( TOTAL_FAIL == 0 )) && exit 0 || exit 1
