#!/usr/bin/env bash
# check-client-leaks.sh
#
# Scans the repo for any reference to a specific RevealUI Studio client,
# prospect, or warm-intro contact. Customer/prospect names belong in the
# private internal repo only. Never in this public surface.
#
# Exit 0 on clean. Exit 1 on any violation. Exit 2 on tool/setup error.
#
# Usage:
#   bash scripts/check-client-leaks.sh                     # scan repo root
#   bash scripts/check-client-leaks.sh <path> [<path>...]  # scan specific paths
#   LEAK_JSON=1 bash scripts/check-client-leaks.sh         # machine-readable
#
# CI wiring: .github/workflows/check-client-leaks.yml
# REQUIRED status check on `test` and `main` branch protection.
#
# Pattern source, one line each (format: tag|literal-string|reason):
#   CLIENT_LEAK_PATTERNS                 required in CI (org Actions secret)
#   .client-name-watchlist.local         optional gitignored fallback locally
# Add the line to the CLIENT_LEAK_PATTERNS org secret. Never to a committed
# file. There is no .leakignore for this scanner. The property must be
# unconditional once a pattern source is present.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_PATHS=("$@")
[[ ${#SCAN_PATHS[@]} -eq 0 ]] && SCAN_PATHS=("$REPO_ROOT")

for _path in "${SCAN_PATHS[@]}"; do
  if [[ ! -e "$_path" ]]; then
    echo "[client-leak] error: scan path not found: $_path" >&2
    exit 2
  fi
done
unset _path

# REGEX-CONFIG-BOUNDARY: the strings consumed by grep -F (fixed strings),
# so each pattern is a literal substring. No metacharacter handling.
# No regex authored.

in_ci=0
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  in_ci=1
fi

pattern_raw=""
if [[ -n "${CLIENT_LEAK_PATTERNS:-}" && -n "${CLIENT_LEAK_PATTERNS//[[:space:]]/}" ]]; then
  pattern_raw="$CLIENT_LEAK_PATTERNS"
elif [[ "$in_ci" -eq 1 ]]; then
  echo "[client-leak] error: CLIENT_LEAK_PATTERNS is empty or unset. CI must provide the org Actions secret CLIENT_LEAK_PATTERNS. Refusing to pass." >&2
  exit 2
elif [[ -f "$REPO_ROOT/.client-name-watchlist.local" ]]; then
  pattern_raw="$(<"$REPO_ROOT/.client-name-watchlist.local")"
else
  echo "[client-leak] warning: CLIENT_LEAK_PATTERNS is unset and .client-name-watchlist.local is missing. Refusing to report a pass." >&2
  exit 2
fi

PATTERNS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  trimmed="${line#"${line%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  case "$trimmed" in
    ''|'#'*) continue ;;
  esac
  if [[ "$trimmed" != *"|"*"|"* ]]; then
    echo "[client-leak] error: a pattern line is not tag|literal|reason. Refusing to scan." >&2
    exit 2
  fi
  tag="${trimmed%%|*}"
  rest="${trimmed#*|}"
  literal="${rest%%|*}"
  if [[ -z "$tag" || -z "$literal" ]]; then
    echo "[client-leak] error: a pattern line has an empty tag or literal. Refusing to scan." >&2
    exit 2
  fi
  PATTERNS+=("$trimmed")
done <<< "$pattern_raw"
unset line trimmed tag rest literal pattern_raw

if (( ${#PATTERNS[@]} == 0 )); then
  echo "[client-leak] error: CLIENT_LEAK_PATTERNS produced no pattern lines. Refusing to scan." >&2
  exit 2
fi

# Directories / file globs to skip
EXCLUDE_DIRS=(node_modules .git dist build .next .turbo .pnpm coverage target .direnv .nyc_output playwright-report test-results)
EXCLUDE_FILES=(
  pnpm-lock.yaml package-lock.json yarn.lock Cargo.lock
  # Gitignored local pattern source. It holds the literal list on purpose.
  .client-name-watchlist.local
  CHANGELOG.md
  '*.png' '*.jpg' '*.jpeg' '*.gif' '*.webp' '*.pdf' '*.zip' '*.tar.gz' '*.tgz'
  '*.ico' '*.woff' '*.woff2' '*.ttf' '*.otf'
  '*.har' '*.snap'
)

if ! command -v grep >/dev/null 2>&1; then
  echo "[client-leak] error: grep not found on PATH" >&2
  exit 2
fi

grep_excludes=()
for d in "${EXCLUDE_DIRS[@]}"; do
  grep_excludes+=(--exclude-dir="$d")
done
for f in "${EXCLUDE_FILES[@]}"; do
  grep_excludes+=(--exclude="$f")
done

violations=0
json_entries=()

for entry in "${PATTERNS[@]}"; do
  tag="${entry%%|*}"
  rest="${entry#*|}"
  pattern="${rest%%|*}"
  reason="${rest#*|}"

  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    file="${hit%%:*}"
    rest_="${hit#*:}"
    line="${rest_%%:*}"
    content="${rest_#*:}"

    if [[ -n "${LEAK_JSON:-}" ]]; then
      if command -v jq >/dev/null 2>&1; then
        json_entries+=("$(jq -cn --arg tag "$tag" --arg file "$file" --arg line "$line" --arg reason "$reason" --arg content "$content" \
          '{tag:$tag, file:$file, line:($line|tonumber), reason:$reason, content:$content}')")
      else
        safe="${content//\\/\\\\}"
        safe="${safe//\"/\\\"}"
        safe="${safe//$'\n'/\\n}"
        safe="${safe//$'\t'/\\t}"
        sreason="${reason//\\/\\\\}"
        sreason="${sreason//\"/\\\"}"
        json_entries+=("{\"tag\":\"$tag\",\"file\":\"$file\",\"line\":$line,\"reason\":\"$sreason\",\"content\":\"$safe\"}")
      fi
    else
      printf '[CLIENT-LEAK:%s] %s:%s - %s\n  -> %s\n' "$tag" "$file" "$line" "$reason" "$content"
    fi
    violations=$((violations+1))
  done < <(grep -rFIn "${grep_excludes[@]}" -- "$pattern" "${SCAN_PATHS[@]}" 2>/dev/null || true)
done

if [[ -n "${LEAK_JSON:-}" ]]; then
  printf '{"violations":%d,"entries":[%s]}\n' "$violations" "$(IFS=,; echo "${json_entries[*]:-}")"
fi

if (( violations > 0 )); then
  if [[ -z "${LEAK_JSON:-}" ]]; then
    echo "" >&2
    echo "[client-leak] FAIL - $violations violation(s)." >&2
    echo "" >&2
    echo "Customer / prospect names must NEVER appear in this public-facing repo." >&2
    echo "Move the content to the private internal repo (or genericize with a" >&2
    echo "placeholder like 'Acme Corp' / 'acme' / 'first customer')." >&2
    echo "" >&2
    echo "If a new client onboards and their name needs scanner coverage, add" >&2
    echo "the line to the CLIENT_LEAK_PATTERNS org Actions secret. Never add it" >&2
    echo "to a committed file." >&2
  fi
  exit 1
fi

[[ -z "${LEAK_JSON:-}" ]] && echo "[client-leak] OK - no client/prospect names detected across: ${SCAN_PATHS[*]}"
exit 0
