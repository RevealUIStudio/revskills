---
name: revealui-sync-lts
description: Sync RevealUI suite repos to the LTS drive (E: / /mnt/e) per per-repo declared mode (bundle or mirror). Refuses to sync repos without an .claude/lts-mode declaration.
license: MIT
allowed-tools: Bash, Read
metadata:
  author: RevealUI Studio
  version: "0.2.0"
  website: https://revealui.com
---

Sync suite repos to the LTS drive. LTS mode is declared per-repo at `.claude/lts-mode` (values: `bundle` or `mirror`). If absent, refuse to sync and prompt user to declare.

Load helpers:
```bash
. "$HOME/suite/revskills/scripts/lib/session-state.sh"
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
2. **For each suite repo** (iterate `~/suite/*/` excluding dotfiles):
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
