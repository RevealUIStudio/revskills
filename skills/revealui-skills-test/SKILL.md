---
name: revealui-skills-test
description: Static validator for Claude Code skills. Dry-runs every skill in ~/.claude/commands/*.md, validates referenced scripts exist, flags stale ~/projects/ paths, rule violations (git -C, pnpm --dir, inline node -e), tmux references. Read-only — catches broken skills before users hit them at run time.
license: MIT
allowed-tools: Bash, Read, Glob, Grep
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

Validate each skill in `~/.claude/commands/*.md` without executing its side effects. Goal: catch broken skills (stale paths, missing scripts, rule-violating commands) before a user invokes them and discovers the failure at run-time.

Load helpers:
```bash
. "$HOME/suite/revskills/scripts/lib/session-state.sh"
```

## For each `~/.claude/commands/*.md`

### 1. Frontmatter
- If frontmatter present, confirm it's valid YAML.
- Confirm `description` is non-empty.

### 2. Referenced scripts
Extract every path matching:
- `$HOME/.claude/...` or `~/.claude/...`
- `$HOME/suite/revskills/...` or `~/suite/revskills/...`
- `bash "<path>"` or `node "<path>"` or `tsx "<path>"`

For each, assert the target file exists. Missing = FAIL.

### 3. Referenced repos
Extract every path matching `~/suite/...` or `~/projects/...`. Assert existence.
- `~/projects/*` in real path usage = FAIL (migrated to `~/suite/`).
- `~/suite/*` non-existent = FAIL.

### 4. Rule compliance (via awk linter)
Run `awk -f "$HOME/suite/revskills/scripts/lib/lint-skill.awk" <skill>`. Emits `ISSUE: <tag>:<line>:<text>` per violation. The linter scopes checks to fenced code blocks and skips deny-listed prose ("Do not", "never", "avoid", "DISABLED") to avoid false positives. Tags:
- `stale-projects-path` — `~/projects/` in real path usage (migrated to `~/suite/`)
- `git-C-violates-bash.md` — `git -C <path>` in executable code
- `pnpm-dir-violates-bash.md` — `pnpm --dir` / `pnpm -C` in executable code
- `inline-node-e-violates-hooks.md` — `node -e "…"` in executable code
- `tmux-legacy` — tmux references in executable code (Studio-native migration)

### 5. CLI soundness
For each `<cli> <subcommand>` invocation, confirm the CLI exists on PATH and the subcommand appears in its `--help` output. Known CLIs to verify: `revvault`, `run-task`, `direnv`, `pnpm`, `nix`, `gh`, `git`.

### 6. Status marker
If the skill's first H1/frontmatter contains `DISABLED`, record as SKIP (not FAIL).

## Output

Table:
```
skill              status   issues
revealui-recover   PASS     -
revealui-doctor    PASS     -
...
```

Plus a `FAIL summary` section listing every failure with file:line and a remediation hint. Exit non-zero if any FAIL (for CI). JSON sidecar at `/tmp/claude-skills-test-last.json`.

For CI / pre-commit enforcement (no Claude required) run the batch validator directly:
```bash
bash "$HOME/suite/revskills/scripts/lint-all-skills.sh"         # human output
bash "$HOME/suite/revskills/scripts/lint-all-skills.sh" --json  # machine output
```
Exits 0 on clean, 1 on any lint / frontmatter / broken-symlink violation. Use this in a pre-push hook to prevent regressions.

## Do not
- Do not execute the skill bodies — parse statically only.
- Do not modify any file — read-only validator.
