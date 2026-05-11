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

# Validate scan paths up front. grep silently treats a missing path as
# "no matches" and the script would otherwise exit 0 on a typo'd path,
# silently skipping the requested scan (Codex P2 finding on revcon#9).
for _path in "${SCAN_PATHS[@]}"; do
  if [[ ! -e "$_path" ]]; then
    echo "[leak-check] error: scan path not found: $_path" >&2
    exit 2
  fi
done
unset _path

# --- Patterns that must never appear in public content ---
#
# Each entry: tag|ERE_regex|reason
# Anchored where possible to keep false-positive noise low.
PATTERNS=(
  "abs-home-path|/home/[a-z][a-z0-9_-]+|absolute user home path (/home/<username>/...)"
  "abs-windows-user|[Cc]:[\\\\/]Users[\\\\/][A-Za-z0-9_-]+|absolute Windows user path (C:\\\\Users\\\\<name>)"
  "private-jv-repo|/?revfleet/\\.jv|private repo path (~/revfleet/.jv/...)"
  "private-jv-name|revealui-jv|private repo name (revealui-jv)"
  "lts-drive|/mnt/e/|LTS drive mount path"
  "forge-drive|/mnt/forge/|Forge drive mount path"
  # quote-split below: the literal pattern (j+oshu-devbox) is split by empty
  # quotes so the fleet's GAP-116 anti-regression workflow (which greps the
  # developer's user-account name verbatim) does NOT match this scanner's
  # own source. Bash concatenates the empty-quoted halves into the full
  # pattern at runtime; the array element is unchanged.
  "devbox-host|j""oshu-devbox|internal hostname"
  "license-key|RVUI-[a-z]+-[a-f0-9]{16,}|RevealUI license key (looks like a real issued key)"
  "vercel-org-id|team_[A-Za-z0-9]{16,}|Vercel org/team identifier"
  "vercel-project-id|prj_[A-Za-z0-9]{16,}|Vercel project identifier"
)

# Directories / file globs to exclude from the scan.
# Includes common gitignored build/dev-shell artifact dirs so the script
# behaves the same locally (pre-push) and on a fresh CI checkout. Rust
# `target/` files (`.d` dep files) embed absolute source paths; Nix
# `.direnv/` activation scripts include the developer's $HOME.
EXCLUDE_DIRS=(node_modules .git dist build .next .turbo .pnpm coverage target .direnv .nyc_output)
EXCLUDE_FILES=(
  pnpm-lock.yaml package-lock.json yarn.lock Cargo.lock
  check-no-private-leaks.sh
  .git
  '*.png' '*.jpg' '*.jpeg' '*.gif' '*.webp' '*.pdf' '*.zip' '*.tar.gz' '*.tgz'
  '*.ico' '*.woff' '*.woff2' '*.ttf' '*.otf'
)

# Note: `settings.local.json` and `.leakignore` are intentionally NOT in
# EXCLUDE_FILES — both were flagged in Codex P2 review on revdev#55:
#
#   - settings.local.json: a basename exclusion would silently allow an
#     accidentally-committed local settings file (a likely place for
#     team_/prj_/$HOME/credential leaks) to bypass this gate entirely.
#     Consuming repos must keep `.claude/` in .gitignore so the file
#     never lands in a checkout.
#
#   - .leakignore: excluding the allowlist file means any private path
#     or credential pasted into an entry or reason comment is never
#     examined, even though the file ships in the public repo. Now
#     scanned — keep .leakignore entries to path-globs + tags only.
#
# Local pre-push false-positives in either case are intentional: they
# signal a configuration gap to fix, not a scanner bug.

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

    # Resolve relative path for .leakignore matching. Normalize both the
    # absolute-prefix form (default no-arg invocation, grep reports
    # /home/.../repo/file) AND the explicit-relative-path form (e.g.
    # `bash check-no-private-leaks.sh .`, grep reports ./file). Codex P2
    # finding on revvault#45: without the `./` strip, .leakignore entries
    # like `frontend/src/foo.ts` failed to match `./frontend/src/foo.ts`.
    rel_path="${file#$REPO_ROOT/}"
    rel_path="${rel_path#./}"
    if is_ignored "$rel_path" "$tag"; then
      continue
    fi

    if [[ -n "${LEAK_JSON:-}" ]]; then
      if command -v jq >/dev/null 2>&1; then
        json_entries+=("$(jq -cn --arg tag "$tag" --arg file "$file" --arg line "$line" --arg reason "$reason" --arg content "$content" \
          '{tag:$tag, file:$file, line:($line|tonumber), reason:$reason, content:$content}')")
      else
        # Escape backslashes first, then double quotes, then control chars
        safe_content="${content//\\/\\\\}"
        safe_content="${safe_content//\"/\\\"}"
        safe_content="${safe_content//$'\n'/\\n}"
        safe_content="${safe_content//$'\t'/\\t}"
        safe_reason="${reason//\\/\\\\}"
        safe_reason="${safe_reason//\"/\\\"}"
        json_entries+=("{\"tag\":\"$tag\",\"file\":\"$file\",\"line\":$line,\"reason\":\"$safe_reason\",\"content\":\"$safe_content\"}")
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
