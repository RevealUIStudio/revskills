#!/usr/bin/env bash
# Prepare one session's checkpoint in a fresh .jv worktree. This is the local
# filesystem/Git transaction; publication and owner disposition stay in the
# checkpoint skill. No commit, push, or hook bypass occurs here.
set -euo pipefail

usage() {
  printf '%s\n' 'usage: checkpoint-prepare.sh --jv-root DIR --identity SLUG --handoff-body-file FILE --workboard-line-file FILE [--stage]' >&2
  exit 2
}

jv_root='' identity='' handoff_input='' workboard_input='' stage=0
while (($#)); do
  case "$1" in
    --jv-root|--identity|--handoff-body-file|--workboard-line-file)
      (($# >= 2)) || usage
      case "$1" in
        --jv-root) jv_root="$2" ;;
        --identity) identity="$2" ;;
        --handoff-body-file) handoff_input="$2" ;;
        --workboard-line-file) workboard_input="$2" ;;
      esac
      shift 2 ;;
    --stage) stage=1; shift ;;
    *) usage ;;
  esac
done

[[ "$jv_root" = /* && -d "$jv_root" ]] || usage
# Native session IDs allow 128 chars; ss_identity prefixes "session-" (8).
[[ "$identity" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,135}$ && "$identity" != stagehand ]] || usage
[[ -f "$handoff_input" && ! -L "$handoff_input" && -f "$workboard_input" && ! -L "$workboard_input" ]] || usage
[[ "$jv_root" != *$'\n'* ]] || usage
jv_root="$(cd "$jv_root" && pwd -P)"

actual_root="$(cd "$jv_root" && git rev-parse --show-toplevel)"
[[ "$actual_root" = "$jv_root" ]] || {
  printf '%s\n' 'checkpoint-prepare: --jv-root must be the checkout root' >&2
  exit 2
}

stamp="$(date -u +%Y%m%dT%H%M%S%NZ)"
branch="chore/checkpoint-${stamp}-${identity}-$$"
worktree="${jv_root}-wt/ckpt-${stamp}-${identity}-$$"
mkdir -p "${jv_root}-wt"

# Fetch the base without moving HEAD or touching files in the shared checkout.
(cd "$jv_root" && git fetch origin +refs/heads/test:refs/remotes/origin/test) >&2
(cd "$jv_root" && git worktree add -b "$branch" "$worktree" origin/test) >&2
trap 'status=$?; if ((status != 0)); then printf "checkpoint-prepare: worktree preserved: %s\n" "$worktree" >&2; fi' EXIT

handoff_path="$(node "$worktree/scripts/handoff-fragment.js" --id "$identity" \
  --base "$worktree/docs/handoffs/rolling" < "$handoff_input")"
workboard_path="$(node "$worktree/scripts/workboard-fragment.js" --kind log \
  --id "$identity" --base "$worktree/.revealui/workboard.d" < "$workboard_input")"
case "$handoff_path" in "$worktree/docs/handoffs/rolling/"*) ;; *) echo 'checkpoint-prepare: invalid handoff path' >&2; exit 1 ;; esac
case "$workboard_path" in "$worktree/.revealui/workboard.d/log/"*) ;; *) echo 'checkpoint-prepare: invalid workboard path' >&2; exit 1 ;; esac
[[ -f "$handoff_path" && ! -L "$handoff_path" && -f "$workboard_path" && ! -L "$workboard_path" ]] || {
  echo 'checkpoint-prepare: writer output is not a regular fragment file' >&2
  exit 1
}
handoff_rel="${handoff_path#"$worktree"/}"
workboard_rel="${workboard_path#"$worktree"/}"

if ((stage)); then
  (cd "$worktree" && git add -- "$handoff_rel" "$workboard_rel")
  expected="$(printf '%s\n' "$handoff_rel" "$workboard_rel" | LC_ALL=C sort)"
  staged="$(cd "$worktree" && git diff --cached --name-only | LC_ALL=C sort)"
  [[ "$staged" = "$expected" ]] || {
    echo 'checkpoint-prepare: staged paths differ from this session fragments' >&2
    exit 1
  }
  (cd "$worktree" && git diff --cached --check)
fi

# Stable four-line result. Generated names cannot contain newlines.
printf '%s\n' "$branch" "$worktree" "$handoff_path" "$workboard_path"
