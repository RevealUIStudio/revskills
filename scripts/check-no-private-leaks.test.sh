#!/usr/bin/env bash
# An untracked gitignored file is not a leak, and the same bytes in a
# tracked file still fail. A directory that is not a git work tree keeps
# the old behavior and still fails.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN="$ROOT/scripts/check-no-private-leaks.sh"
# Assembled so this tracked test file does not itself contain a leak path.
prefix=/home
user=example
PAYLOAD="${prefix}/${user}/secret"
TAG="$(basename "$ROOT")"

cleanup() {
  git -C "$ROOT" rm --cached -q -- .claude/settings.local.json leak-scan-fixture/note.txt >/dev/null 2>&1 || true
  rm -f "$ROOT/.claude/settings.local.json"
  rm -rf "$ROOT/leak-scan-fixture"
  rm -rf "$NONGIT"
}
NONGIT=""
trap cleanup EXIT

mkdir -p "$ROOT/.claude"
printf '%s\n' "$PAYLOAD" > "$ROOT/.claude/settings.local.json"
set +e
bash "$SCAN" "$ROOT/.claude" >/tmp/leak-untracked-"$TAG".txt
code=$?
set -e
if [[ "$code" -ne 0 ]]; then
  echo "untracked gitignored file should exit 0, got $code" >&2
  cat /tmp/leak-untracked-"$TAG".txt >&2
  exit 1
fi

mkdir -p "$ROOT/leak-scan-fixture"
printf '%s\n' "$PAYLOAD" > "$ROOT/leak-scan-fixture/note.txt"
git -C "$ROOT" add -- leak-scan-fixture/note.txt
set +e
bash "$SCAN" "$ROOT/leak-scan-fixture" >/tmp/leak-tracked-"$TAG".txt
code=$?
set -e
git -C "$ROOT" rm --cached -q -- leak-scan-fixture/note.txt
rm -rf "$ROOT/leak-scan-fixture"
if [[ "$code" -ne 1 ]]; then
  echo "tracked file should exit 1, got $code" >&2
  cat /tmp/leak-tracked-"$TAG".txt >&2
  exit 1
fi

git -C "$ROOT" add -f -- .claude/settings.local.json
set +e
bash "$SCAN" "$ROOT/.claude" >/tmp/leak-forced-"$TAG".txt
code=$?
set -e
git -C "$ROOT" rm --cached -q -- .claude/settings.local.json
rm -f "$ROOT/.claude/settings.local.json"
if [[ "$code" -ne 1 ]]; then
  echo "tracked gitignored file should exit 1, got $code" >&2
  cat /tmp/leak-forced-"$TAG".txt >&2
  exit 1
fi

NONGIT="$(mktemp -d)"
mkdir -p "$NONGIT/scripts"
cp "$SCAN" "$NONGIT/scripts/check-no-private-leaks.sh"
printf '%s\n' "$PAYLOAD" > "$NONGIT/note.txt"
set +e
bash "$NONGIT/scripts/check-no-private-leaks.sh" "$NONGIT" >/tmp/leak-nongit-"$TAG".txt
code=$?
set -e
if [[ "$code" -ne 1 ]]; then
  echo "non-git directory should still exit 1, got $code" >&2
  cat /tmp/leak-nongit-"$TAG".txt >&2
  exit 1
fi

echo "check-no-private-leaks gitignore cases passed"
