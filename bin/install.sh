#!/usr/bin/env bash
# Install revskills bin/ scripts as symlinks in ~/.local/bin.
#
# Idempotent: re-running updates symlinks to point at the repo copies.
# Refuses to overwrite a regular file — back it up first.
#
# Usage: bash ~/suite/revskills/bin/install.sh

set -euo pipefail

REPO_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${REVSKILLS_BIN_TARGET:-$HOME/.local/bin}"

mkdir -p "$TARGET_DIR"

installed=0
skipped=0
for src in "$REPO_BIN"/*; do
  name="$(basename "$src")"
  case "$name" in
    install.sh|README*) continue ;;
  esac
  [[ -f "$src" && -x "$src" ]] || continue

  dest="$TARGET_DIR/$name"
  if [[ -L "$dest" ]]; then
    ln -sfn "$src" "$dest"
    printf '[install] updated symlink %s -> %s\n' "$dest" "$src"
    installed=$((installed+1))
  elif [[ -e "$dest" ]]; then
    printf '[install] skip %s — regular file exists; back it up and re-run\n' "$dest" >&2
    skipped=$((skipped+1))
  else
    ln -sfn "$src" "$dest"
    printf '[install] linked %s -> %s\n' "$dest" "$src"
    installed=$((installed+1))
  fi
done

printf '[install] done (%d installed, %d skipped)\n' "$installed" "$skipped"
exit 0
