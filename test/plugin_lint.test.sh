#!/usr/bin/env bash
# test/plugin_lint.test.sh — tests for scripts/lint-plugins.sh.
#
# What it checks (grounded in scripts/lint-plugins.sh): every
# .claude-plugin/plugin.json under the scanned root must declare "name"
# and "description", its "version" must be semver or a commit hash (or
# the containing directory name must be), every *.sh file must be free of
# inline `node -e`, unquoted `eval $VAR`, unquoted `rm -rf $VAR`, and
# `curl|bash` patterns, and every SKILL.md must have frontmatter with
# name: and description:.
#
# The good/bad manifests here are generated at test time into a mktemp
# sandbox rather than committed under test/fixtures/: CI's existing
# "plugin-lint" job runs `lint-plugins.sh .` against the whole checked
# out repo, and `lint-plugins.sh` discovers every .claude-plugin/
# plugin.json anywhere in the tree it's pointed at. A committed bad
# fixture would make that corpus-wide job fail on a fixture that is
# deliberately invalid, which is not what that job is for.

test_plugin_lint_good_manifest_passes() {
  local sandbox
  sandbox="$(make_sandbox)"
  mkdir -p "$sandbox/fixture-good-plugin/.claude-plugin"
  cat > "$sandbox/fixture-good-plugin/.claude-plugin/plugin.json" <<'JSON'
{
  "name": "fixture-good-plugin",
  "version": "0.1.0",
  "description": "Fixture plugin proving plugin-lint accepts a well formed manifest."
}
JSON
  assert_exit "plugin-lint accepts a well formed manifest" 0 \
    -- bash "$REPO_ROOT/scripts/lint-plugins.sh" "$sandbox"
}

test_plugin_lint_missing_field_fails() {
  local sandbox
  sandbox="$(make_sandbox)"
  mkdir -p "$sandbox/fixture-bad-plugin/.claude-plugin"
  cat > "$sandbox/fixture-bad-plugin/.claude-plugin/plugin.json" <<'JSON'
{
  "name": "fixture-bad-plugin",
  "version": "0.1.0"
}
JSON
  assert_exit "plugin-lint rejects a manifest missing description" 1 \
    -- bash "$REPO_ROOT/scripts/lint-plugins.sh" "$sandbox"
  assert_contains "failure output names the missing field" \
    "missing required field 'description'" "$LAST_OUTPUT"
}

test_plugin_lint_real_manifest_passes() {
  # The repo's own .claude-plugin/plugin.json, run in isolation, must
  # itself be a valid manifest by the same rules.
  local sandbox
  sandbox="$(make_sandbox)"
  mkdir -p "$sandbox/revskills/.claude-plugin"
  cp "$REPO_ROOT/.claude-plugin/plugin.json" "$sandbox/revskills/.claude-plugin/plugin.json"
  assert_exit "plugin-lint accepts the repo's real plugin.json" 0 \
    -- bash "$REPO_ROOT/scripts/lint-plugins.sh" "$sandbox"
}
