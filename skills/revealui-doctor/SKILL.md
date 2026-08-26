---
name: revealui-doctor
description: Health check for RevFleet Studio workflow across equal adapters (Claude + Grok at minimum). Verifies hook/rules homes, skill preconditions, git integrity, workboard freshness, daemon status, MCP configs, env leaks, toolchain, and disaster-recovery snapshot state.
license: MIT
allowed-tools: Bash, Read, Glob, Grep
metadata:
  author: RevealUI Studio
  version: "0.4.1"
  website: https://revealui.com
---

Run a health check on **Studio-native** workflow surfaces for equal adapters. Report pass/fail (or SKIP with reason) per section. Claude is one adapter; Grok is first-class.

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## 0. Adapter homes present

Report which homes exist:

| Adapter | Paths to note |
|---------|----------------|
| Claude | `~/.claude/{hooks,rules,commands,settings.json}` |
| Grok | `~/.grok/{hooks,rules,skills,config.toml,active_sessions.json}` |
| Cursor | `~/.cursor` or project `.cursor/` (SKIP if absent) |
| OpenCode | tool-specific (SKIP if absent) |

If Claude home is missing: do **not** fail the whole doctor — continue with Grok/other and mark Claude sections SKIP.

## 1. Hook syntax

**Claude:** `node --check` on every `~/.claude/hooks/*.js` when the dir exists. List failures. Confirm `settings.json` registers `PreCompact` → `snapshot-before-compact.js` (last-ditch mechanical capture).  
**Grok:** list `~/.grok/hooks/*.json` when present; confirm JSON parses (`python3 -m json.tool` or `jq`). FAIL on invalid JSON. Required for snapshot-before-compact: `pre-compact.json` and `stop-snapshot.json` (or equivalent PreCompact + Stop entries) pointing at `snapshot-before-compact.js`. WARN if either event is missing — Grok auto-compacts at 85% and discards UserPromptSubmit stdout, so without these hooks checkpoints lose pre-compact fidelity.

## 2. Rules directories

Verify these exist and contain `.md` files when the home is present:

- `~/revfleet/revealui/.claude/rules/`
- `$JV_REPO/.claude/rules/`
- `~/.claude/rules/` (Claude adapter)
- `~/.grok/rules/` (Grok adapter; pointer files OK)

## 3. Skills self-test

Prefer SoT + multi-home:

```bash
bash "$HOME/revfleet/revskills/scripts/lint-all-skills.sh"
```

Additionally, for each present command/skill root (`~/.claude/commands`, `~/.grok` skill paths from config if readable):

- Extract referenced script paths under `~/.claude`, `~/revfleet/revskills`, `node`/`bash` invocations.
- Assert each referenced script exists. Report missing.
- Flag any `~/suite/` references as stale (retired 2026-05-07 → `~/revfleet/`).

## 4. Git integrity (RevFleet repos)

For each repo in `~/revfleet/revealui` and `$JV_REPO`:
```bash
cd "$repo" && git fsck --full 2>&1 | grep -E '^(error|fatal|missing)'
ss_empty_objects "$repo"
```
Empty objects = WSL crash damage. Report loudly.

## 5. Workboard freshness

Parse `$WORKBOARD` (`$JV_REPO/.claude/workboard.md`). In `## Log`, flag `[CRASHED]` entries older than 24h.

## 6. Events log size

`~/revfleet/revealui/.claude/events.jsonl` and `$JV_REPO/.claude/events.jsonl`. Warn if over 100KB.

## 7. Daemon + Studio surface health

```bash
ss_daemon_alive && echo "daemon: up" || echo "daemon: down"
ss_revvault_alive && echo "revvault: up" || echo "revvault: down"
```

## 8. MCP servers

**Claude:** if `~/.claude/config.json` exists, extract `mcpServers` and verify `command` / `cwd` / absolute `args` paths.  
**Grok:** if `~/.grok/config.toml` has MCP / server entries (or document SKIP when config shape is opaque), note presence; do not invent a second MCP schema.  
Flag any stale `~/projects/RevealUI` path.

## 9. Git-tracked env files

In both RevFleet repos: `git ls-files '*.env*'`. SAFE vs REVIEW classification as before (allowlist from repo security gate; do not hardcode).

## 10. Settings JSON validity

**Claude:** validate `~/.claude/settings.json` and `settings.local.json` if present.  
**Grok:** validate `~/.grok/config.toml` parses if present (toml via python or skip with note).

## 11. Toolchain

```bash
pnpm -v; node -v; biome --version 2>/dev/null || echo "biome via pnpm exec"
cd ~/revfleet/revealui && test -f flake.lock && nix flake metadata --json >/dev/null 2>&1 && echo "flake: ok" || echo "flake: check"
cd ~/revfleet/revealui && direnv status 2>&1 | tail -3
```

## 12. Disaster recovery (WSL snapshot)

Per-repo LTS sync is retired. Flag leftover `.claude/lts-mode` under `~/revfleet/*/`. Snapshot freshness is Windows-side — SKIP with pointer to revkit `check-backup-staleness.ps1` when LTS drive unreachable.

## 13. Session id auto-resolve (GAP-469)

```bash
ss_session_id && echo "session-id: ok" || echo "session-id: unresolved (non-fatal outside a harness session)"
```

## Output

Traffic-light summary (PASS/WARN/FAIL/SKIP) per section **and per adapter**. JSON sidecar at `/tmp/revealui-doctor-last.json` (prefer this over Claude-only path names).
