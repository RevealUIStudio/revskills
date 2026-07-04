---
name: revealui-sync-rules
description: Check whether .claude/rules/ files are in sync across the RevealUI repos. Never auto-copies — always asks the user for direction first.
license: MIT
allowed-tools: Bash
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

Run the sync-rules check and report results.

Execute: `bash ~/.claude/hooks/sync-rules.sh`

If all files are in sync, confirm that.

If any files differ, list them and ask which direction to copy.

Do NOT auto-copy — always ask for direction first.
