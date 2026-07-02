---
name: revealui-sync-lts
description: |
  DEPRECATED 2026-07-02 — the per-repo LTS sync model (bundle/mirror declared
  in .claude/lts-mode) is retired. Disaster recovery is the weekly whole-distro
  WSL snapshot (Windows scheduled task RevealUI-WSL-Weekly-Backup, shipped as
  revkit scripts/weekly-wsl-backup.ps1 with staleness alerting). Retained for
  reference; will be removed in a future revskills major.
license: MIT
allowed-tools: Bash, Read
metadata:
  author: RevealUI Studio
  version: "0.3.0"
  website: https://revealui.com
  deprecated: true
  deprecated-at: "2026-07-02"
  superseded-by: revkit weekly WSL snapshot task (no in-repo skill successor)
---

## DEPRECATED 2026-07-02

The per-repo LTS model this skill drives (`.claude/lts-mode` = `bundle` |
`mirror`, per-repo copies under the LTS drive) was retired when disaster
recovery moved to weekly whole-distro WSL snapshots (`wsl --export` via the
Windows scheduled task `RevealUI-WSL-Weekly-Backup`; source + staleness
alerting live in revkit `scripts/weekly-wsl-backup.ps1` +
`scripts/check-backup-staleness.ps1`). GitHub remains the source of truth for
repo content. Do not re-adopt per-repo bundles/mirrors; leftover
`.claude/lts-mode` files are stale residue.

The original skill body follows for historical reference.

---

Sync RevFleet repos to the LTS drive. LTS mode is declared per-repo at `.claude/lts-mode` (values: `bundle` or `mirror`). If absent, refuse to sync and prompt user to declare.

Load helpers:
```bash
. "$HOME/revfleet/revskills/scripts/lib/session-state.sh"
```

## Modes

**`bundle`** — dated `git bundle` snapshots, no live clone
- Destination: `/mnt/e/professional/<RepoName>/`
- Action: `cd <repo> && git bundle create /mnt/e/professional/<RepoName>/<repo>-$(date +%Y%m%d-%H%M).bundle --all`
- Retain last 10 bundles, prune older.

**`mirror`** — live bare clone at LTS, pushed on sync
- Destination: `/mnt/e/professional/<RepoName>.git` (bare clone)
- Precondition: remote `lts` configured in repo; `/mnt/e/professional/<RepoName>.git` exists as bare repo.
- Action: `cd <repo> && git push lts --all && git push lts --tags`

## Steps

1. **Discover LTS mount**: `mount | grep /mnt/e` — fail if not mounted.
2. **For each RevFleet repo** (iterate `~/revfleet/*/` excluding dotfiles):
   - Skip if not a git repo.
   - Read `<repo>/.claude/lts-mode`. If missing, print `unconfigured: <repo>` and continue.
   - If `bundle`: create dated bundle, prune old, verify via `cd /mnt/e/professional/<RepoName> && git bundle verify <file>`.
   - If `mirror`: verify bare clone exists, verify `lts` remote, push all refs + tags.
3. **Report**: per-repo status line (`<repo>: mode=bundle | bundles=10 | latest=<file>` or `<repo>: mode=mirror | ahead=0 | behind=0`).
4. **Uncommitted changes**: for any repo with unstaged/staged changes, list them under a "Not yet backed up (working tree)" section — bundles/mirrors only capture committed state.

## Do not
- Do not run `git -C <path>` — use `cd <repo> && cmd` per `bash.md`.
- Do not auto-create an `lts` remote or bare clone — that's a one-time setup the user should authorize.
- Do not delete older bundles below the retention floor without confirming.
