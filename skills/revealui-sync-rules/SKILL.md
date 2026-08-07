---
name: revealui-sync-rules
description: Verify agent rules distribution topology across RevealUI repos (revcon profiles, materialized copies). Prefer control-layer / revcon entrypoints; Claude hook path is one adapter. Read-only; never mutates without asking.
license: MIT
allowed-tools: Bash
metadata:
  author: RevealUI Studio
  version: "0.3.0"
  website: https://revealui.com
---

Run the topology check and report results.

## Entry points (first match wins)

```bash
# 1) Control-layer / revcon when available
if [ -x "$HOME/revfleet/revcon/link.sh" ]; then
  # report-only: do not run link.sh without owner ask; prefer check scripts
  echo "revcon present: $HOME/revfleet/revcon"
fi
if [ -f "$HOME/revfleet/revskills/scripts/verify-copy-lockstep.sh" ]; then
  bash "$HOME/revfleet/revskills/scripts/verify-copy-lockstep.sh" 2>/dev/null || true
fi

# 2) Claude adapter hook (legacy Studio path)
if [ -f "$HOME/.claude/hooks/sync-rules.sh" ]; then
  bash "$HOME/.claude/hooks/sync-rules.sh"
elif [ -f "$HOME/.claude/hooks/sync-rules.js" ]; then
  node "$HOME/.claude/hooks/sync-rules.js" 2>/dev/null || true
else
  echo "SKIP: no sync-rules entry on this machine — inspect revcon profiles + .claude/.revcon-manifest.json manually"
fi
```

How to interpret output (two sanctioned distribution modes):

- `<repo>: materialized` — git-tracked copies + `.claude/.revcon-manifest.json`; content verification is that repo's rules-lockstep CI.
- `BROKEN SYMLINK` / `FOREIGN TARGET` (exit 1) — fix on revcon side; report and ask before touching.
- `VENDORED COPY` (warn) — regular file shadows profile rule without manifest; present options and ask.

Do **not** auto-fix. Report, then ask for direction.

Historical note: independent dual-copy diffs against the coordination hub were retired 2026-07-16.
