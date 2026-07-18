#!/usr/bin/env bash
# test/corpus.test.sh — every real skill/plugin/repo path in this checkout
# must pass all three validators, run unmodified against the real repo
# root. This is the assertion the CI "Validator Test Suite" job exists to
# enforce on every PR, not only at pre-push time.

test_corpus_skills_lint_passes() {
  assert_exit "skills-lint passes the real skills/ corpus" 0 \
    -- bash "$REPO_ROOT/scripts/lint-all-skills.sh"
}

# Mirrors ci.yml's exact invocation (`bash scripts/lint-plugins.sh .` from
# the repo root). CACHE_ROOT must be "." here, not an absolute path: when
# CACHE_ROOT is ".", a plugin rooted at the repo collapses plugin_id to
# "revskills" (the manifest's own name, per lint-plugins.sh's fallback),
# which is what .pluginlintignore's "revskills*" entries target to
# suppress the two documented self-matches (lint-plugins.sh's own
# comments describing the rm-rf and curl|bash rules trip those same
# rules when the scanner scans itself). An absolute CACHE_ROOT produces a
# different, unmatched plugin_id and would report those as new failures.
plugin_lint_corpus() {
  (cd "$REPO_ROOT" && bash scripts/lint-plugins.sh .)
}

test_corpus_plugin_lint_passes() {
  assert_exit "plugin-lint passes the repo's real .claude-plugin/plugin.json" 0 \
    -- plugin_lint_corpus
}

test_corpus_leak_scan_passes() {
  assert_exit "private-leak-scan passes the whole repo" 0 \
    -- bash "$REPO_ROOT/scripts/check-no-private-leaks.sh"
}
