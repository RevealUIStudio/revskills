#!/usr/bin/env bash
# test/skills_lint.test.sh — tests for scripts/lint-all-skills.sh.
#
# What it checks (grounded in scripts/lint-all-skills.sh, read before
# writing these tests): every skills/*/SKILL.md must start with `---`
# frontmatter and declare `name:` and `description:`, must pass the
# scripts/lib/lint-skill.awk rule scan (no tmux/git -C/pnpm --dir/
# inline node -e in code blocks, no stale ~/suite/ paths), and every
# symlink under ~/.claude/commands/ must resolve to a real file.

test_skills_lint_good_fixture_passes() {
  local sandbox
  sandbox="$(make_isolated_skills_lint_env good-skill)"
  assert_exit "skills-lint accepts a valid minimal skill" 0 \
    -- bash "$sandbox/scripts/lint-all-skills.sh"
}

test_skills_lint_missing_field_fails() {
  local sandbox
  sandbox="$(make_isolated_skills_lint_env bad-skill-missing-field)"
  assert_exit "skills-lint rejects a skill missing description:" 1 \
    -- bash "$sandbox/scripts/lint-all-skills.sh"
  assert_contains "failure output names the missing field" \
    "missing 'description:' field" "$LAST_OUTPUT"
}

test_skills_lint_broken_symlink_fails() {
  local fake_home
  fake_home="$(make_isolated_home_with_commands broken-ref.md)"
  assert_exit "skills-lint rejects a dangling command symlink (broken script reference)" 1 \
    -- env HOME="$fake_home" bash "$REPO_ROOT/scripts/lint-all-skills.sh"
  assert_contains "failure output flags the broken symlink" \
    "broken-ref.md" "$LAST_OUTPUT"
}

test_skills_lint_good_symlink_passes() {
  local fake_home
  fake_home="$(make_isolated_home_with_commands good-ref.md)"
  assert_exit "skills-lint accepts a resolving command symlink" 0 \
    -- env HOME="$fake_home" bash "$REPO_ROOT/scripts/lint-all-skills.sh"
}
