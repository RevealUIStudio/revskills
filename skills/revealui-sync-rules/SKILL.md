---
name: revealui-sync-rules
description: Verify the .claude/rules distribution topology across the RevealUI repos (symlinks into revcon profiles, or materialized copies gated in-repo). Read-only; never mutates, always asks before any fix.
license: MIT
allowed-tools: Bash
metadata:
  author: RevealUI Studio
  version: "0.2.0"
  website: https://revealui.com
---

Run the topology check and report results.

Execute: `bash ~/.claude/hooks/sync-rules.sh`

How to interpret the output (the check models the two sanctioned
distribution modes; there are no independent per-repo copies to diff):

- `<repo>: materialized` means the repo carries git-tracked copies with a
  `.claude/.revcon-manifest.json`; content verification belongs to that
  repo's own rules-lockstep CI gate, and this check deliberately defers.
- `BROKEN SYMLINK` or `FOREIGN TARGET` (exit 1) means a repo rule symlink
  no longer resolves into `~/revfleet/revcon/profiles/`. The fix is on the
  revcon side (re-run its link script, or repair the moved/renamed profile
  rule). Report it and ask before touching anything.
- `VENDORED COPY` (warn-only) means a regular file shadows a same-named
  revcon profile rule in a repo without a manifest. Present the three
  options and ask: symlink it, materialize the repo, or record why it is
  intentionally repo-local.

Do NOT auto-fix anything. Report, then ask for direction.

Historical note: this skill previously diffed repo rules against the
internal coordination repo's copies as two independent files. That model
was retired 2026-07-16; those copies diverge by design, and the old check
reported permanent false drift.
