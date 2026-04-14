#!/usr/bin/env bash
# check-no-private-leaks.sh
#
# Scans a public-facing directory (default: the revskills repo root) for
# references to private filesystem paths, private repos, or machine-local
# user homes that must not appear in public artifacts.
#
# Exit 0 on clean. Exit 1 on any violation. Exit 2 on tool/setup error.
#
# Usage:
#   bash scripts/check-no-private-leaks.sh                     # scan default (repo root)
#   bash scripts/check-no-private-leaks.sh <path> [<path>...]  # scan explicit paths
#   LEAK_JSON=1 bash scripts/check-no-private-leaks.sh         # machine-readable output
#
# Uses POSIX grep -rE so it runs anywhere (CI, pre-push, bare shells).
# Safe to rerun; read-only.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_PATHS=("$@")
[[ ${#SCAN_PATHS[@]} -eq 0 ]] && SCAN_PATHS=("$REPO_ROOT")

# --- Patterns that must never appear in public content ---
#
# Each entry: tag|ERE_regex|reason
# Anchored where possible to keep false-positive noise low.
PATTERNS=(
  "abs-home-path|/home/[a-z][a-z0-9_-]+|absolute user home path (/home/<username>/...)"
  "abs-windows-user|[Cc]:[\\\\/]Users[\\\\/][A-Za-z0-9_-]+|absolute Windows user path (C:\\\\Users\\\\<name>)"
  "private-jv-repo|/?suite/\\.jv|private repo path (~/suite/.jv/...)"
  "private-jv-name|revealui-jv|private repo name (revealui-jv)"
  "lts-drive|/mnt/e/|LTS drive mount path"
  "forge-drive|/mnt/forge/|Forge drive mount path"
  "devbox-host|joshu-devbox|internal hostname"
)

# Directories / file globs to exclude from the scan.
EXCLUDE_DIRS=(node_modules .git dist build .next .turbo .pnpm coverage)
EXCLUDE_FILES=(
  pnpm-lock.yaml package-lock.json yarn.lock
  check-no-private-leaks.sh
  '*.png' '*.jpg' '*.jpeg' '*.gif' '*.webp' '*.pdf' '*.zip' '*.tar.gz' '*.tgz'
  '*.ico' '*.woff' '*.woff2' '*.ttf' '*.otf'
)

if ! command -v grep >/dev/null 2>&1; then
  echo "[leak-check] error: grep not found on PATH" >&2
  exit 2
fi

# Build grep excludes
grep_excludes=()
for d in "${EXCLUDE_DIRS[@]}"; do
  grep_excludes+=(--exclude-dir="$d")
done
for f in "${EXCLUDE_FILES[@]}"; do
  grep_excludes+=(--exclude="$f")
done

# --- Load .leakignore allowlist (optional) ---
#
# Format per line: <path-glob> <tag[,tag...]>  # reason
# Blank lines and lines starting with # are skipped.
#
# The allowlist is keyed by (relative-path, tag). A violation is suppressed
# only if BOTH the path matches the glob AND the emitted tag is listed.
IGNORE_FILE="$REPO_ROOT/.leakignore"
declare -a IGNORE_GLOBS=()
declare -a IGNORE_TAGS=()
if [[ -f "$IGNORE_FILE" ]]; then
  while IFS= read -r raw; do
    # Strip comments and whitespace.
    line="${raw%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    glob="${line%%[[:space:]]*}"
    tags="${line#*[[:space:]]}"
    tags="${tags#"${tags%%[![:space:]]*}"}"
    [[ -z "$tags" || "$tags" = "$glob" ]] && continue
    IGNORE_GLOBS+=("$glob")
    IGNORE_TAGS+=("$tags")
  done < "$IGNORE_FILE"
fi

is_ignored() {
  local rel_path="$1" tag="$2"
  local i glob tagspec t
  for i in "${!IGNORE_GLOBS[@]}"; do
    glob="${IGNORE_GLOBS[$i]}"
    tagspec="${IGNORE_TAGS[$i]}"
    # Simple glob match — bash extglob via == with nocaseglob off.
    # shellcheck disable=SC2053
    if [[ "$rel_path" == $glob ]]; then
      IFS=',' read -ra tagarr <<< "$tagspec"
      for t in "${tagarr[@]}"; do
        t="${t//[[:space:]]/}"
        [[ "$t" = "$tag" ]] && return 0
      done
    fi
  done
  return 1
}

violations=0
json_entries=()

for entry in "${PATTERNS[@]}"; do
  tag="${entry%%|*}"
  rest="${entry#*|}"
  regex="${rest%%|*}"
  reason="${rest#*|}"

  # grep -rEIn: recursive, extended-regex, skip binary, show line numbers.
  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    file="${hit%%:*}"
    rest_="${hit#*:}"
    line="${rest_%%:*}"
    content="${rest_#*:}"

    # Resolve relative path for .leakignore matching.
    rel_path="${file#$REPO_ROOT/}"
    if is_ignored "$rel_path" "$tag"; then
      continue
    fi

    if [[ -n "${LEAK_JSON:-}" ]]; then
      if command -v jq >/dev/null 2>&1; then
        json_entries+=("$(jq -cn --arg tag "$tag" --arg file "$file" --arg line "$line" --arg reason "$reason" --arg content "$content" \
          '{tag:$tag, file:$file, line:($line|tonumber), reason:$reason, content:$content}')")
      else
        safe_content="${content//\"/\\\"}"
        json_entries+=("{\"tag\":\"$tag\",\"file\":\"$file\",\"line\":$line,\"reason\":\"$reason\",\"content\":\"$safe_content\"}")
      fi
    else
      printf '[LEAK:%s] %s:%s — %s\n  → %s\n' "$tag" "$file" "$line" "$reason" "$content"
    fi
    violations=$((violations+1))
  done < <(grep -rEIn "${grep_excludes[@]}" -- "$regex" "${SCAN_PATHS[@]}" 2>/dev/null || true)
done

if [[ -n "${LEAK_JSON:-}" ]]; then
  printf '{"violations":%d,"entries":[%s]}\n' "$violations" "$(IFS=,; echo "${json_entries[*]:-}")"
fi

if (( violations > 0 )); then
  [[ -z "${LEAK_JSON:-}" ]] && echo "[leak-check] FAIL — $violations violation(s). Fix before publishing." >&2
  exit 1
fi

[[ -z "${LEAK_JSON:-}" ]] && echo "[leak-check] OK — no private paths detected across: ${SCAN_PATHS[*]}"
exit 0
