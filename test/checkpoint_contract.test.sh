#!/usr/bin/env bash
# Integration proof for the maintained local checkpoint transaction.
# Synthetic Git repositories and fragment writers keep this independent of .jv.

test_checkpoint_prepare_isolates_dirty_checkout_and_exact_staging() {
  local scratch seed shared body line before after head_before result worktree staged expected long_identity
  scratch="$(mktemp -d "${TMPDIR:-/tmp}/revskills-checkpoint-test.XXXXXX")"
  seed="$scratch/seed"; shared="$scratch/main"
  mkdir -p "$seed/scripts"
  git init -q --initial-branch=test "$seed"
  cat >"$seed/scripts/handoff-fragment.js" <<'JS'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv;
const base = argv[argv.indexOf('--base') + 1];
const id = argv[argv.indexOf('--id') + 1];
mkdirSync(base, { recursive: true });
const out = join(base, `synthetic-${id}.md`);
writeFileSync(out, readFileSync(0));
process.stdout.write(`${out}\n`);
JS
  cat >"$seed/scripts/workboard-fragment.js" <<'JS'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv;
const base = join(argv[argv.indexOf('--base') + 1], 'log');
const id = argv[argv.indexOf('--id') + 1];
mkdirSync(base, { recursive: true });
const out = join(base, `synthetic-${id}.md`);
writeFileSync(out, readFileSync(0));
process.stdout.write(`${out}\n`);
JS
  # Node treats .js as ESM in the real .jv repo.
  printf '%s\n' '{"type":"module"}' >"$seed/package.json"
  printf '%s\n' 'base file' >"$seed/README.md"
  (cd "$seed" && git add . && git -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm base)
  git clone -q --branch test "$seed" "$shared"
  printf '%s\n' 'shared peer edit' >>"$shared/README.md"
  mkdir -p "$shared/docs/handoffs/rolling"
  printf '%s\n' 'peer fragment' >"$shared/docs/handoffs/rolling/peer.md"
  before="$(cd "$shared" && git status --porcelain=v1)"
  head_before="$(cd "$shared" && git rev-parse HEAD)"
  body="$scratch/body.txt"; line="$scratch/workboard.txt"
  printf '%s\n' '## Last merge' 'synthetic checkpoint' >"$body"
  printf '%s\n' '- [synthetic] codex: checkpoint' >"$line"

  if ! result="$(bash "$REPO_ROOT/scripts/checkpoint-prepare.sh" --jv-root "$shared" \
      --identity codex-test --handoff-body-file "$body" --workboard-line-file "$line" --stage 2>"$scratch/prepare.log")"; then
    fail "checkpoint prepare should succeed" "$(cat "$scratch/prepare.log")"
    rm -rf "$scratch"
    return
  fi
  local -a fields
  mapfile -t fields <<<"$result"
  if [[ "${#fields[@]}" -ne 4 ]]; then
    fail "checkpoint prepare returns four artifact fields" "$result"
    rm -rf "$scratch"
    return
  fi
  worktree="${fields[1]}"
  expected="$(printf '%s\n' "${fields[2]#"$worktree"/}" "${fields[3]#"$worktree"/}" | LC_ALL=C sort)"
  staged="$(cd "$worktree" && git diff --cached --name-only | LC_ALL=C sort)"
  assert_eq "$expected" "$staged" "only this checkpoint's two writer-returned files are staged"
  after="$(cd "$shared" && git status --porcelain=v1)"
  assert_eq "$before" "$after" "dirty shared checkout and peer fragment remain untouched"
  assert_eq "$head_before" "$(cd "$shared" && git rev-parse HEAD)" "shared HEAD remains unchanged"
  assert_eq "test" "$(cd "$shared" && git branch --show-current)" "shared branch remains test"
  assert_eq "$(printf '%s\n' 'base file' 'shared peer edit')" "$(cat "$shared/README.md")" "shared tracked edit bytes remain unchanged"
  assert_eq "peer fragment" "$(cat "$shared/docs/handoffs/rolling/peer.md")" "peer fragment bytes remain unchanged"
  if [[ -f "$worktree/docs/handoffs/rolling/peer.md" ]]; then
    fail "peer untracked fragment must not appear in isolated worktree"
  else
    pass "peer untracked fragment is absent from isolated worktree"
  fi
  if [[ -f "${fields[2]}" && -f "${fields[3]}" ]]; then
    pass "both generated fragments exist in isolated worktree"
  else
    fail "both generated fragments should exist"
  fi

  # Existing --no-commit behavior remains an unstaged isolated handoff.
  long_identity="session-$(printf 'a%.0s' {1..128})"
  if result="$(bash "$REPO_ROOT/scripts/checkpoint-prepare.sh" --jv-root "$shared" \
      --identity "$long_identity" --handoff-body-file "$body" --workboard-line-file "$line" 2>"$scratch/no-stage.log")"; then
    mapfile -t fields <<<"$result"
    if [[ -z "$(cd "${fields[1]}" && git diff --cached --name-only)" ]]; then
      pass "maximum derived identity is accepted and no-commit leaves fragments unstaged"
    else
      fail "no-commit preparation must leave fragments unstaged"
    fi
  else
    fail "no-commit preparation should succeed" "$(cat "$scratch/no-stage.log")"
  fi
  rm -rf "$scratch"
}
