#!/usr/bin/env bash
# test/exhaustive_audit.test.sh — fleet allowlist, by-repo shards, claim
# complete vs release, coverage-status mode split.

SKILL="$REPO_ROOT/skills/exhaustive-audit/scripts"

make_fake_fleet() {
  local root
  root="$(make_sandbox)"
  mkdir -p "$root/agency/app" "$root/revealui/src" "$root/archive/cold" \
    "$root/tmp" "$root/scripts" "$root/.jv/docs" "$root/wt-skip/x"
  printf 'agency\n' >"$root/agency/app/App.tsx"
  printf 'revealui\nline2\n' >"$root/revealui/src/index.ts"
  printf 'should-not-inventory\n' >"$root/archive/cold/DUMP.md"
  printf 'tmp\n' >"$root/tmp/scratch.txt"
  printf 'leftover\n' >"$root/scripts/one.sh"
  printf 'plan\n' >"$root/.jv/docs/TRACKER.md"
  printf 'wt\n' >"$root/wt-skip/x/n.txt"
  printf '%s\n' "$root"
}

test_fleet_skips_archive_tmp_scripts() {
  local fleet out
  fleet="$(make_fake_fleet)"
  out="$(make_sandbox)/manifest.jsonl"
  node "$SKILL/manifest-build.js" --root "$fleet" --fleet --exclude-defaults --out "$out" >/dev/null
  if grep -q '"archive/' "$out"; then
    fail "fleet manifest excludes archive" "archive path present"
    return
  fi
  if grep -q '"tmp/' "$out"; then
    fail "fleet manifest excludes tmp" "tmp path present"
    return
  fi
  if grep -q '"scripts/' "$out"; then
    fail "fleet manifest excludes fleet-root scripts" "scripts path present"
    return
  fi
  if ! grep -q '"agency/app/App.tsx"' "$out"; then
    fail "fleet manifest includes agency" "missing agency path"
    return
  fi
  if ! grep -q '"\.jv/docs/TRACKER.md"' "$out" && ! grep -q '".jv/docs/TRACKER.md"' "$out"; then
    fail "fleet manifest includes .jv" "missing .jv path"
    return
  fi
  pass "fleet manifest excludes archive/tmp/scripts and includes products"
}

test_include_archive_opts_in() {
  local fleet out
  fleet="$(make_fake_fleet)"
  out="$(make_sandbox)/manifest.jsonl"
  node "$SKILL/manifest-build.js" --root "$fleet" --fleet --include-archive --exclude-defaults --out "$out" >/dev/null
  if grep -q '"archive/cold/DUMP.md"' "$out"; then
    pass "include-archive inventories archive"
  else
    fail "include-archive inventories archive" "archive path missing"
  fi
}

test_by_repo_shards_do_not_mix() {
  local fleet man shards
  fleet="$(make_fake_fleet)"
  man="$(make_sandbox)/manifest.jsonl"
  shards="$(make_sandbox)/shards.json"
  node "$SKILL/manifest-build.js" --root "$fleet" --fleet --exclude-defaults --out "$man"
  node "$SKILL/shard-plan.js" --manifest "$man" --out "$shards" --by-repo --target-lines 8000 >/dev/null
  local mixed
  mixed="$(node -e '
    const p=require(process.argv[1]);
    let mixed=0;
    for (const s of p.shards) {
      const repos=new Set(s.paths.map(x=>x.split("/")[0]));
      if (repos.size>1) mixed++;
    }
    process.stdout.write(String(mixed));
  ' "$shards")"
  assert_eq "0" "$mixed" "by-repo shards never mix repos"
}

test_claim_complete_vs_release() {
  local fleet run
  fleet="$(make_fake_fleet)"
  run="$(make_sandbox)/run"
  node "$SKILL/open-run.js" --root "$fleet" --fleet --slug t --out "$run" --mode code >/dev/null
  local shard
  shard="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.shards[0].id);' "$run/shards.json")"
  node "$SKILL/claim-shard.js" --run "$run" --shard "$shard" --agent a1 >/dev/null
  node "$SKILL/claim-shard.js" --run "$run" --shard "$shard" --complete --agent a1 >/dev/null
  local status
  status="$(node -e 'const p=require(process.argv[1]); process.stdout.write(p.shards[0].status);' "$run/shards.json")"
  assert_eq "done" "$status" "complete marks shard done"
  local claim_rc
  claim_rc=0
  node "$SKILL/claim-shard.js" --run "$run" --shard "$shard" --agent a2 >/dev/null 2>&1 || claim_rc=$?
  if [[ "$claim_rc" -ne 0 ]]; then
    pass "cannot reclaim a done shard"
  else
    fail "cannot reclaim a done shard" "claim of done shard succeeded"
  fi
  local rel_rc
  rel_rc=0
  node "$SKILL/claim-shard.js" --run "$run" --shard "$shard" --release >/dev/null 2>&1 || rel_rc=$?
  if [[ "$rel_rc" -ne 0 ]]; then
    pass "release does not reopen a done shard"
  else
    fail "release does not reopen a done shard" "release of done succeeded"
  fi
}

test_coverage_mode_split() {
  local dir man led
  dir="$(make_sandbox)"
  man="$dir/m.jsonl"
  led="$dir/c.jsonl"
  printf '%s\n' '{"path":"a.ts","lines":2,"sha256":"aa"}' >"$man"
  printf '%s\n' '{"path":"a.ts","status":"historical-ok","lines_read":[1,2]}' >"$led"
  local code_rc md_rc
  code_rc=0
  md_rc=0
  node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode code >/dev/null 2>&1 || code_rc=$?
  node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode md-truth >/dev/null 2>&1 || md_rc=$?
  assert_eq "1" "$code_rc" "code mode rejects historical-ok"
  assert_eq "0" "$md_rc" "md-truth mode accepts historical-ok"

  printf '%s\n' '{"path":"a.ts","status":"verified"}' >"$led"
  local ver_rc=0
  node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode code >/dev/null 2>&1 || ver_rc=$?
  assert_eq "1" "$ver_rc" "code mode refuses verified without lines_read"

  printf '%s\n' '{"path":"a.ts","status":"finding","lines_read":[1,2]}' >"$led"
  local find_rc=0
  node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode code >/dev/null 2>&1 || find_rc=$?
  assert_eq "1" "$find_rc" "code mode refuses finding without finding_ids"

  printf '%s\n' '{"path":"a.ts","status":"verified","lines_read":[1,2]}' >"$led"
  local ok_rc=0
  node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode code >/dev/null 2>&1 || ok_rc=$?
  assert_eq "0" "$ok_rc" "code mode accepts verified with full span"
}

test_md_truth_self_test() {
  assert_exit "md-truth-check --self-test still passes" 0 \
    -- node "$SKILL/md-truth-check.js" --self-test
}
