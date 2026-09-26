#!/usr/bin/env bash
# Job lock: rfloop is the operator-plane PR/CI stub, not a product runtime.

test_rfloop_header_locks_operator_job() {
  local hdr
  hdr="$(sed -n '1,12p' "$REPO_ROOT/bin/rfloop")"
  assert_contains "header locks the PR/CI job" "PR/CI operator disk state machine only" "$hdr"
  assert_contains "header names the P0 stub" "P0 stub" "$hdr"
  assert_contains "header locks auto-merge" "auto-merge locked" "$hdr"
  assert_contains "header denies the fleet brain" "not the fleet brain" "$hdr"
  assert_contains "header denies product AgentRuntime" "product AgentRuntime" "$hdr"
}

test_rfloop_stub_does_not_act() {
  local src
  assert_exit "rfloop stub exits without acting" 2 -- "$REPO_ROOT/bin/rfloop"
  assert_contains "stub repeats the lock" "Auto-merge locked" "$LAST_OUTPUT"
  src="$(cat "$REPO_ROOT/bin/rfloop")"
  if [[ "$src" == *"gh "* ]]; then
    fail "rfloop must not invoke gh"
  else
    pass "rfloop does not invoke gh"
  fi
}

test_revloop_is_rename_shim() {
  local hdr
  hdr="$(sed -n '1,8p' "$REPO_ROOT/bin/revloop")"
  assert_contains "revloop header is a rename shim" "rename shim" "$hdr"
  assert_contains "revloop header prefers rfloop" "Prefer rfloop" "$hdr"
  assert_exit "revloop delegates to the rfloop stub" 2 -- "$REPO_ROOT/bin/revloop"
  assert_contains "shim surfaces the rfloop lock" "Not the fleet brain" "$LAST_OUTPUT"
}

test_planes_documented_and_checkpoint_write_ssot() {
  local spec readme skill
  spec="$(cat "$REPO_ROOT/docs/MASTER_SPEC.md")"
  readme="$(cat "$REPO_ROOT/README.md")"
  skill="$(cat "$REPO_ROOT/skills/revealui-checkpoint/SKILL.md")"
  assert_contains "spec names three planes" "three planes" "$spec"
  assert_contains "spec keeps rfloop operator-only" "rfloop\` is operator-only" "$spec"
  assert_contains "readme names three planes" "Three planes" "$readme"
  assert_contains "readme locks the rfloop sentence" "PR/CI operator disk state machine only" "$readme"
  if [[ "$skill" == *'WORKBOARD="$JV_ROOT/.claude/workboard.md"'* ]]; then
    fail "checkpoint still assigns WORKBOARD to the Claude adapter path"
  else
    pass "checkpoint does not assign WORKBOARD to the Claude adapter path"
  fi
  assert_contains "checkpoint writes .revealui/workboard.d" ".revealui/workboard.d" "$skill"
  assert_contains "checkpoint renders the neutral board" ".revealui/workboard.md" "$skill"
}
