---
name: revealui-doctor
description: Health check for RevFleet Claude Code setup + Studio-native workflow. Verifies hook syntax, rules directories, skill preconditions, git integrity across RevFleet repos, workboard freshness, daemon status, MCP servers, env file leaks, settings JSON validity, toolchain, and LTS sync mode.
license: MIT
allowed-tools: Bash, Read, Glob, Grep
metadata:
  author: RevealUI Studio
  version: "0.2.0"
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
- `~/revfleet/.jv/.claude/rules/`
- `~/.claude/rules/`

## 3. Skills self-test
For each `~/.claude/commands/*.md`:
- Parse frontmatter if present.
- Extract referenced script paths (`$HOME/.claude/...`, `~/.claude/...`, `~/revfleet/revskills/...`, `node "..."`, `bash "..."`).
- Assert each referenced script exists. Report missing.
- Extract referenced repo paths (`~/revfleet/...`, `~/projects/...`, `~/suite/...`). Assert existence; flag any `~/suite/` references as stale (path retired 2026-05-07 — should be `~/revfleet/`).

## 4. Git integrity (both RevFleet repos)
For each repo in `~/revfleet/revealui` and `~/revfleet/.jv`:
```bash
cd "$repo" && git fsck --full 2>&1 | grep -E '^(error|fatal|missing)'
ss_empty_objects "$repo"
```
Empty objects = WSL crash damage. Report loudly.

## 5. Workboard freshness
Parse `$WORKBOARD` (`~/revfleet/.jv/.claude/workboard.md`). In the `## Log` section, flag `[CRASHED]` entries older than 24h — these should have been triaged by `/recover`.

## 6. Events log size
`~/revfleet/revealui/.claude/events.jsonl` and `~/revfleet/.jv/.claude/events.jsonl`. Warn if over 100KB.

## 7. Daemon + Studio surface health
```bash
ss_daemon_alive && echo "daemon: up" || echo "daemon: down"
ss_revvault_alive && echo "revvault: up" || echo "revvault: down"
```
Flag daemon down (primary coordination layer per hooks-architecture.md).

## 8. MCP servers
Read `~/.claude/config.json`, extract `mcpServers`, verify each `command` binary is on PATH.

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

## 12. LTS sync mode
Check `~/revfleet/revealui/.claude/lts-mode` (expected: `bundle` or `mirror`). If absent, flag as unconfigured. Check `/mnt/e/professional/RevealUI/` matches declared mode.

## Output
Traffic-light summary (PASS/WARN/FAIL) per section. JSON sidecar at `/tmp/claude-doctor-last.json` so the daemon can consume results.
