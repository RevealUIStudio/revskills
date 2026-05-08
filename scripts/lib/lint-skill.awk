#!/usr/bin/awk -f
# Lint a single skill file. Emit one "ISSUE: <tag>:<line>" per violation.
# Rules:
#   stale-suite-path            — ~/suite/ or $HOME/suite/ used as a real path (path retired 2026-05-07; migrated to ~/revfleet/)
#   git-C-violates-bash.md      — `git -C <path>` in executable code
#   pnpm-dir-violates-bash.md   — `pnpm --dir` or `pnpm -C` in executable code
#   inline-node-e-violates-hooks.md — `node -e "…"` in executable code
#   tmux-legacy                 — any mention of tmux (except in explicit deny/description lines)
# Scope:
#   - Only fenced ```…``` code blocks are treated as executable code for grep-able anti-patterns.
#   - Lines starting with `#` inside code blocks (shell comments) are skipped.
#   - Anywhere (not just code blocks): "Do not", "DO NOT", "never", "avoid" deny-list lines are skipped.
BEGIN { in_code = 0 }
/^```/ { in_code = !in_code; next }
{
  line = $0
  # skip deny-listed prose
  if (line ~ /[Dd]o ?[Nn]ot|[Nn]ever|[Aa]void|legacy|DISABLED/) next
  # skip frontmatter description line
  if (line ~ /^description:/) next
  # inside code blocks: skip shell comments
  if (in_code && line ~ /^[ \t]*#/) next
  # tmux — only flag in code blocks (mentions in prose are usually explanatory)
  if (in_code && line ~ /(tmux|TMUX_PANE)/) print "ISSUE: tmux-legacy:" NR ":" line
  # ~/suite/ paths — flag only as real path usage (path retired 2026-05-07; migrated to ~/revfleet/)
  if (line ~ /(~|\$HOME)\/suite\//) {
    # allow if line is clearly a description mentioning the pattern itself in backticks
    if (line !~ /`[^`]*\/suite\/[^`]*`/ || in_code) {
      print "ISSUE: stale-suite-path:" NR ":" line
    }
  }
  # git -C (code only)
  if (in_code && line ~ /git -C /) print "ISSUE: git-C-violates-bash.md:" NR ":" line
  # pnpm --dir / -C (code only)
  if (in_code && line ~ /pnpm (--dir|-C) /) print "ISSUE: pnpm-dir-violates-bash.md:" NR ":" line
  # node -e "..." (code only)
  if (in_code && line ~ /node -e "/) print "ISSUE: inline-node-e-violates-hooks.md:" NR ":" line
}
