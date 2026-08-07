#!/usr/bin/env bash
# stamp-session-id.sh — SessionStart hook helper (GAP-469 automatic session id).
#
# Writes the harness session id under the neutral coordination root keyed by
# ancestor PIDs so agent tool shells can resolve ss_session_id without the
# operator exporting anything.
#
# Invoked from Grok/Claude SessionStart hooks. Env (hook-injected):
#   GROK_SESSION_ID | CLAUDE_CODE_SESSION_ID | AGENT_SESSION_ID
#
# Usage (hook command):
#   bash "$HOME/revfleet/revskills/scripts/stamp-session-id.sh"
#
# Safe to re-run; always exit 0 so SessionStart never blocks.

set -uo pipefail

SID="${AGENT_SESSION_ID:-${REVEALUI_SESSION_ID:-${GROK_SESSION_ID:-${CLAUDE_CODE_SESSION_ID:-}}}}"
if [ -z "$SID" ]; then
  # Try stdin JSON (Grok SessionStart may provide sessionId on stdin envelope)
  if command -v python3 >/dev/null 2>&1; then
    SID="$(python3 -c '
import json,sys
try:
    raw=sys.stdin.read()
    if not raw.strip():
        raise SystemExit
    o=json.loads(raw)
    print(o.get("sessionId") or o.get("session_id") or "")
except Exception:
    pass
' 2>/dev/null || true)"
  fi
fi

if [ -z "$SID" ]; then
  exit 0
fi

ROOT="${REVEALUI_COORD_ROOT:-$HOME/.local/share/revealui/coordination}"
BY_PID="$ROOT/harness-sessions/by-pid"
mkdir -p "$BY_PID"

# Stamp ancestors of this process (not init/pid 1–2) so agent tool shells match.
pid=$$
n=0
while [ "$pid" -gt 2 ] && [ "$n" -lt 40 ]; do
  printf '%s\n' "$SID" >"$BY_PID/$pid"
  next="$(awk '/^PPid:/{print $2}' "/proc/${pid}/status" 2>/dev/null)" || break
  [ -z "$next" ] && break
  pid="$next"
  n=$((n + 1))
done

printf '%s\n' "$SID" >"$ROOT/harness-sessions/latest"
exit 0
