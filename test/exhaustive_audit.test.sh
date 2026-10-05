#!/usr/bin/env bash
# test/exhaustive_audit.test.sh — fleet allowlist, by-repo shards, claim
# complete vs release, coverage-status mode split.

SKILL="$REPO_ROOT/skills/exhaustive-audit/scripts"

make_fake_fleet() {
  local root
  root="$(make_sandbox)"
  mkdir -p "$root/agency/app" "$root/revealui/src" "$root/archive/cold" \
    "$root/tmp" "$root/scripts" "$root/.jv/docs" "$root/wt-skip/x" \
    "$root/docs/walk" "$root/revmind/notes"
  printf 'agency\n' >"$root/agency/app/App.tsx"
  printf 'revealui\nline2\n' >"$root/revealui/src/index.ts"
  printf 'should-not-inventory\n' >"$root/archive/cold/DUMP.md"
  printf 'tmp\n' >"$root/tmp/scratch.txt"
  printf 'leftover\n' >"$root/scripts/one.sh"
  printf 'plan\n' >"$root/.jv/docs/TRACKER.md"
  printf 'wt\n' >"$root/wt-skip/x/n.txt"
  printf 'fleet-doc\n' >"$root/docs/walk/note.md"
  printf 'not-md\n' >"$root/docs/walk/note.txt"
  printf 'mind\n' >"$root/revmind/notes/README.md"
  printf 'code\n' >"$root/revmind/notes/main.ts"
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
  if ! grep -q '"docs/walk/note.md"' "$out" || ! grep -q '"revmind/notes/README.md"' "$out"; then
    fail "fleet manifest includes root docs and revmind" "missing default fleet paths"
    return
  fi
  pass "fleet manifest excludes archive/tmp/scripts and includes products"
}

test_md_truth_manifest_is_markdown_only() {
  local fleet run
  fleet="$(make_fake_fleet)"
  run="$(make_sandbox)/run"
  node "$SKILL/open-run.js" --root "$fleet" --fleet --slug md --out "$run" --mode md-truth >/dev/null
  for expected in '"docs/walk/note.md"' '"revmind/notes/README.md"'; do
    if ! grep -q "$expected" "$run/manifest.jsonl"; then
      fail "md-truth manifest includes $expected" "expected markdown path is missing"
      return
    fi
  done
  for excluded in '"docs/walk/note.txt"' '"agency/app/App.tsx"' '"revmind/notes/main.ts"'; do
    if grep -q "$excluded" "$run/manifest.jsonl"; then
      fail "md-truth manifest excludes $excluded" "non-markdown path was inventoried"
      return
    fi
  done
  pass "md-truth manifest inventories markdown only across default fleet scope"
}

test_open_run_retains_exact_source_after_worktree_drift() {
  local root run snapshot
  root="$(make_sandbox)"
  run="$(make_sandbox)/run"
  mkdir -p "$root/src"
  printf 'original source\n' >"$root/src/changed.ts"
  node "$SKILL/open-run.js" --root "$root" --slug drift --out "$run" >/dev/null
  snapshot="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const row = JSON.parse(fs.readFileSync(process.argv[1], "utf8").trim());
    if (!row.snapshot) process.exit(2);
    process.stdout.write(path.resolve(path.dirname(process.argv[1]), row.snapshot));
  ' "$run/manifest.jsonl")"
  printf 'changed later\n' >"$root/src/changed.ts"
  assert_eq "original source" "$(cat "$snapshot")" "open-run preserves exact manifest content after source drift"
  local snapshot_mode
  snapshot_mode="$(stat -c %a "$snapshot")"
  assert_eq "600" "$snapshot_mode" "manifest source snapshots are private"
  local hash_match
  hash_match="$(node -e '
    const fs = require("fs");
    const crypto = require("crypto");
    const row = JSON.parse(fs.readFileSync(process.argv[1], "utf8").trim());
    const actual = crypto.createHash("sha256").update(fs.readFileSync(process.argv[2])).digest("hex");
    process.stdout.write(String(actual === row.sha256));
  ' "$run/manifest.jsonl" "$snapshot")"
  assert_eq "true" "$hash_match" "snapshot SHA-256 matches its manifest row"
}

test_manifest_builder_does_not_inventory_its_own_snapshot_store() {
  local root manifest rows
  root="$(make_sandbox)"
  manifest="$root/manifest.jsonl"
  mkdir -p "$root/src"
  printf 'source\n' >"$root/src/one.ts"
  node "$SKILL/manifest-build.js" --root "$root" --out "$manifest" >/dev/null
  node "$SKILL/manifest-build.js" --root "$root" --out "$manifest" >/dev/null
  rows="$(wc -l <"$manifest" | tr -d ' ')"
  assert_eq "1" "$rows" "manifest rerun excludes its own output and source snapshots"
}

test_manifest_builder_refuses_corrupted_snapshot() {
  local root manifest snapshot rc
  root="$(make_sandbox)"
  manifest="$(make_sandbox)/manifest.jsonl"
  printf 'source\n' >"$root/one.ts"
  node "$SKILL/manifest-build.js" --root "$root" --out "$manifest" >/dev/null
  snapshot="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const row = JSON.parse(fs.readFileSync(process.argv[1], "utf8").trim());
    process.stdout.write(path.resolve(path.dirname(process.argv[1]), row.snapshot));
  ' "$manifest")"
  printf 'corrupt\n' >"$snapshot"
  rc=0
  node "$SKILL/manifest-build.js" --root "$root" --out "$manifest" >/dev/null 2>&1 || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    pass "manifest builder refuses a corrupted existing snapshot"
  else
    fail "manifest builder refuses a corrupted existing snapshot" "corrupted snapshot was accepted"
  fi
}

test_manifest_builder_refuses_snapshot_symlink() {
  local root manifest snapshot replacement rc
  root="$(make_sandbox)"
  manifest="$(make_sandbox)/manifest.jsonl"
  printf 'source\n' >"$root/one.ts"
  node "$SKILL/manifest-build.js" --root "$root" --out "$manifest" >/dev/null
  snapshot="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const row = JSON.parse(fs.readFileSync(process.argv[1], "utf8").trim());
    process.stdout.write(path.resolve(path.dirname(process.argv[1]), row.snapshot));
  ' "$manifest")"
  replacement="$root/replacement"
  printf 'source\n' >"$replacement"
  rm "$snapshot"
  ln -s "$replacement" "$snapshot"
  rc=0
  node "$SKILL/manifest-build.js" --root "$root" --out "$manifest" >/dev/null 2>&1 || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    pass "manifest builder refuses a linked existing snapshot"
  else
    fail "manifest builder refuses a linked existing snapshot" "linked snapshot was accepted"
  fi
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

test_coverage_requires_exact_text_span() {
  local dir man led span
  dir="$(make_sandbox)"
  man="$dir/m.jsonl"
  led="$dir/c.jsonl"
  printf '%s\n' '{"path":"a.ts","lines":2}' >"$man"
  for span in '[2,3]' '[0,1]' '[-1,0]' '[1,1]' '[1,3]' '[2,1]' \
    '[1.5,2.5]' '["1",2]' '[1,"2"]' '[null,2]' '[1,null]' \
    '[1]' '[1,2,3]' 'null' '{}'; do
    printf '{"path":"a.ts","status":"verified","lines_read":%s}\n' "$span" >"$led"
    assert_exit "verified rejects non-exact text span $span" 1 \
      -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
    assert_contains "invalid span $span does not count as covered" '"covered": 0' "$LAST_OUTPUT"
  done
  printf '%s\n' '{"path":"a.ts","status":"finding","finding_ids":["F-1"],"lines_read":[2,3]}' >"$led"
  assert_exit "finding rejects displaced full-length text span" 1 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
  printf '%s\n' '{"path":"a.ts","status":"historical-ok","lines_read":[1,3]}' >"$led"
  assert_exit "md-truth rejects supplied overshooting text span" 1 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode md-truth
  printf '%s\n' '{"path":"a.ts","status":"blocked","lines_read":[1,1]}' >"$led"
  assert_exit "blocked preserves partial-read exemption" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
}

test_coverage_empty_and_binary_conventions() {
  local dir man led span
  dir="$(make_sandbox)"
  man="$dir/m.jsonl"
  led="$dir/c.jsonl"
  printf '%s\n' '{"path":"empty.ts","lines":0}' >"$man"
  printf '%s\n' '{"path":"empty.ts","status":"verified"}' >"$led"
  assert_exit "empty text permits omitted line span" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
  printf '%s\n' '{"path":"empty.ts","status":"verified","lines_read":[0,0]}' >"$led"
  assert_exit "empty text permits established zero span" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
  for span in '[1,1]' '[-1,-1]' '[0,1]' '[0.5,0.5]' '["0",0]' 'null'; do
    printf '{"path":"empty.ts","status":"verified","lines_read":%s}\n' "$span" >"$led"
    assert_exit "empty text rejects invented span $span" 1 \
      -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
  done
  printf '%s\n' '{"path":"binary.dat","lines":null,"binary":true}' >"$man"
  printf '%s\n' '{"path":"binary.dat","status":"blocked"}' >"$led"
  assert_exit "binary manifest retains no text-line requirement" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
}

test_coverage_check_hash_requires_both_declared_hashes() {
  local dir man led hash
  dir="$(make_sandbox)"
  man="$dir/m.jsonl"
  led="$dir/c.jsonl"
  printf '%s\n' '{"path":"a.ts","lines":2,"sha256":"aa"}' >"$man"
  printf '%s\n' '{"path":"a.ts","status":"verified","lines_read":[1,2]}' >"$led"
  assert_exit "hash flag refuses missing ledger hash" 1 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  assert_contains "missing ledger hash is diagnosed" 'ledger-sha256-missing' "$LAST_OUTPUT"
  assert_exit "without hash flag retains unhashed ledger compatibility" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led"
  for hash in 'null' '""' '"   "' '7' '{}'; do
    printf '{"path":"a.ts","status":"verified","lines_read":[1,2],"sha256":%s}\n' "$hash" >"$led"
    assert_exit "hash flag refuses invalid legacy receipt hash $hash" 1 \
      -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  done
  printf '%s\n' '{"path":"a.ts","status":"verified","lines_read":[1,2],"sha256":"aa"}' >"$led"
  assert_exit "hash flag accepts matching legacy receipt hash" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  printf '%s\n' '{"path":"a.ts","lines":2}' >"$man"
  assert_exit "hash flag refuses missing manifest hash" 1 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  assert_contains "missing manifest hash is diagnosed" 'manifest-sha256-missing' "$LAST_OUTPUT"
  for hash in 'null' '""' '"   "' '7' '{}'; do
    printf '{"path":"a.ts","lines":2,"sha256":%s}\n' "$hash" >"$man"
    assert_exit "hash flag refuses invalid manifest hash $hash" 1 \
      -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  done
}

test_coverage_read_hash_takes_precedence() {
  local dir man led hash
  dir="$(make_sandbox)"
  man="$dir/m.jsonl"
  led="$dir/c.jsonl"
  printf '%s\n' '{"path":"a.ts","lines":2,"sha256":"aa"}' >"$man"
  printf '%s\n' '{"path":"a.ts","status":"verified","lines_read":[1,2],"read_sha256":"aa"}' >"$led"
  assert_exit "hash flag accepts explicit matching read hash" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  printf '%s\n' '{"path":"a.ts","status":"verified","lines_read":[1,2],"read_sha256":"bb","sha256":"aa"}' >"$led"
  assert_exit "matching legacy hash cannot mask explicit read mismatch" 1 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  assert_contains "explicit read mismatch is diagnosed" 'sha256-mismatch' "$LAST_OUTPUT"
  printf '%s\n' '{"path":"a.ts","status":"verified","lines_read":[1,2],"read_sha256":"aa","sha256":"bb"}' >"$led"
  assert_exit "explicit matching read hash wins over legacy hash" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  for hash in 'null' '""' '"   "' '7' '{}'; do
    printf '{"path":"a.ts","status":"verified","lines_read":[1,2],"read_sha256":%s,"sha256":"aa"}\n' "$hash" >"$led"
    assert_exit "invalid explicit read hash $hash cannot fall back to legacy hash" 1 \
      -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --check-hash
  done
  printf '%s\n' '{"path":"a.ts","status":"historical-ok"}' >"$led"
  assert_exit "md-truth hash flag also requires receipt hash" 1 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode md-truth --check-hash
  printf '%s\n' '{"path":"a.ts","status":"historical-ok","read_sha256":"aa"}' >"$led"
  assert_exit "md-truth matching hash retains missing-span allowance" 0 \
    -- node "$SKILL/coverage-status.js" --manifest "$man" --ledger "$led" --mode md-truth --check-hash
}
