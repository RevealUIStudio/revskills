---
name: revealui-skills-test
description: Static validator for Studio Agent Skills. Dry-runs skill roots (revskills SoT + equal-adapter command/skill homes), validates referenced scripts exist, flags stale ~/suite/ paths and rule violations. Read-only.
license: MIT
allowed-tools: Bash, Read, Glob, Grep
metadata:
  author: RevealUI Studio
  version: "0.2.0"
  website: https://revealui.com
---

Validate skill installs **without** requiring a Claude-only command dir. Goal: catch broken skills (stale paths, missing scripts, rule-violating commands) before invoke.

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Roots to scan (in order)

1. **SoT (always):** `$HOME/revfleet/revskills/skills/*/SKILL.md`
2. **Adapter homes (when present):**
   - `~/.claude/commands/*.md` (Claude slash / command links)
   - `~/.grok` skill pointers if listed in config, or paths under `[skills].paths`
   - Optional: `REVSKILLS_COMMAND_DIRS` colon list (same as lint-all-skills)

Never FAIL solely because `~/.claude/commands` is missing.

## For each skill file

### 1. Frontmatter

- If frontmatter present, confirm valid YAML-ish (`---` open/close).
- Confirm `description` is non-empty when frontmatter exists.

### 2. Referenced scripts

Extract paths matching:

- `$HOME/.claude/...` or `~/.claude/...`
- `$HOME/.grok/...` or `~/.grok/...`
- `$HOME/revfleet/revskills/...` or `~/revfleet/revskills/...`
- `bash "<path>"` / `node "<path>"` / `tsx "<path>"`

Assert each target exists. Missing = FAIL.

### 3. Referenced repos

Extract `~/revfleet/...`, `~/projects/...`, `~/suite/...`.  
`~/suite/*` = FAIL (retired). Missing `~/revfleet/*` = FAIL.

### 4. Rule compliance (awk linter)

```bash
awk -f "$HOME/revfleet/revskills/scripts/lib/lint-skill.awk" <skill>
```

Tags: `stale-suite-path`, `git-C-violates-bash.md`, `pnpm-dir-violates-bash.md`, `inline-node-e-violates-hooks.md`, `tmux-legacy`.

### 5. CLI soundness

For known CLIs (`revvault`, `pnpm`, `nix`, `gh`, `git`, …): presence on PATH when invoked in skill code blocks.

### 6. Status marker

`DISABLED` in first H1/frontmatter → SKIP.

## Batch / CI (no interactive harness required)

```bash
bash "$HOME/revfleet/revskills/scripts/lint-all-skills.sh"
bash "$HOME/revfleet/revskills/scripts/lint-all-skills.sh" --json
```

Exits 0 on clean, 1 on violation. Preferred pre-push path.

## Output

```
skill              status   issues
revealui-recover   PASS     -
…
```

JSON sidecar: `/tmp/revealui-skills-test-last.json`.

## Do not

- Do not execute skill bodies — parse statically only.
- Do not modify any file — read-only validator.
