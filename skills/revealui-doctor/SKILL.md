---
name: revealui-doctor
description: Health check for RevFleet Claude Code setup + Studio-native workflow. Verifies hook syntax, rules directories, skill preconditions, git integrity across RevFleet repos, workboard freshness, daemon status, MCP servers, env file leaks, settings JSON validity, toolchain, and disaster-recovery snapshot state.
license: MIT
allowed-tools: Bash, Read, Glob, Grep
metadata:
  author: RevealUI Studio
  version: "0.3.0"
  website: https://revealui.com
---

Run a health check on the Claude Code setup and the Studio-native RevealUI workflow. Report pass/fail per item.

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## 1. Hook syntax
Run `node --check` on every `~/.claude/hooks/*.js`. List failures.

## 2. Rules directories
Verify these exist and contain `.md` files:
- `~/revfleet/revealui/.claude/rules/`
- `$JV_REPO/.claude/rules/`
- `~/.claude/rules/`

## 3. Skills self-test
For each `~/.claude/commands/*.md`:
- Parse frontmatter if present.
- Extract referenced script paths (`$HOME/.claude/...`, `~/.claude/...`, `~/revfleet/revskills/...`, `node "..."`, `bash "..."`).
- Assert each referenced script exists. Report missing.
- Extract referenced repo paths (`~/revfleet/...`, `~/projects/...`, `~/suite/...`). Assert existence; flag any `~/suite/` references as stale (path retired 2026-05-07 — should be `~/revfleet/`).

## 4. Git integrity (both RevFleet repos)
For each repo in `~/revfleet/revealui` and `$JV_REPO`:
```bash
cd "$repo" && git fsck --full 2>&1 | grep -E '^(error|fatal|missing)'
ss_empty_objects "$repo"
```
Empty objects = WSL crash damage. Report loudly.

## 5. Workboard freshness
Parse `$WORKBOARD` (`$JV_REPO/.claude/workboard.md`). In the `## Log` section, flag `[CRASHED]` entries older than 24h — these should have been triaged by `/recover`.

## 6. Events log size
`~/revfleet/revealui/.claude/events.jsonl` and `$JV_REPO/.claude/events.jsonl`. Warn if over 100KB.

## 7. Daemon + Studio surface health
```bash
ss_daemon_alive && echo "daemon: up" || echo "daemon: down"
ss_revvault_alive && echo "revvault: up" || echo "revvault: down"
```
Flag daemon down (primary coordination layer per hooks-architecture.md).

## 8. MCP servers
Read `~/.claude/config.json`, extract `mcpServers`. For each server verify BOTH:
- `command` resolves — an absolute path is executable, a bare name is on PATH.
- `cwd` exists as a directory, and any absolute path in `args` exists.

A `pnpm`-launched server still fails silently if its `cwd` points at a missing tree, so
checking `command` alone undercounts. Flag any stale `~/projects/RevealUI` path (retired
tree — should be `~/revfleet/revealui`).

## 9. Git-tracked env files
In both RevFleet repos: `git ls-files '*.env*'`.

A tracked match is only a leak risk if it carries real secrets. Classify before flagging:
- **SAFE (PASS):** filenames matching `*.example`, `*.template`, `.envrc`, plus the repo's
  ratified committed-fixture allowlist. Source the allowlist from the repo itself, not a
  hardcoded copy — `scripts/gates/security-gate.ts` defines `AllowedEnvFiles`
  (currently `.env.template`, `.env.test`, `.env.production.example`). `.env.test` holds
  fake fixtures (`sk_test_*`, `whsec_test*`) and is loaded by `packages/config/src/loader.ts`
  as the CI fallback — it is committed by design, NOT a smell. Do not propose renaming it.
- **REVIEW (FAIL):** any tracked `*.env*` that is NOT in the allowlist or pattern set.
  Scan its contents for real-looking secrets (`sk_live`, long base64/hex) before reporting.

Only REVIEW-class hits count as a leak risk. Mirror the gate's allowlist so this check and
the security gate never disagree.

## 10. Settings JSON validity
Validate `~/.claude/settings.json` and `~/.claude/settings.local.json` if present.

## 11. Toolchain
```bash
pnpm -v; node -v; biome --version 2>/dev/null || echo "biome via pnpm exec"
cd ~/revfleet/revealui && test -f flake.lock && nix flake metadata --json >/dev/null 2>&1 && echo "flake: ok" || echo "flake: check"
cd ~/revfleet/revealui && direnv status 2>&1 | tail -3
```

## 12. Disaster recovery (WSL snapshot)
The per-repo LTS sync model (`.claude/lts-mode` = bundle/mirror) is retired — DR is the weekly whole-distro WSL export run by the Windows scheduled task `RevealUI-WSL-Weekly-Backup` (revkit `scripts/weekly-wsl-backup.ps1`, staleness alerting via `scripts/check-backup-staleness.ps1`). From WSL: flag any leftover `.claude/lts-mode` files under `~/revfleet/*/` as stale residue (PASS when none). Snapshot freshness itself is Windows-side — report SKIP with a pointer to `check-backup-staleness.ps1` when the LTS drive isn't reachable.

## Output
Traffic-light summary (PASS/WARN/FAIL) per section. JSON sidecar at `/tmp/claude-doctor-last.json` so the daemon can consume results.
