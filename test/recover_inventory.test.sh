#!/usr/bin/env bash
# Tests for scripts/recover-inventory.js

_ri() {
  HOME="$1" node "$REPO_ROOT/scripts/recover-inventory.js" "${@:2}"
}

_ri_setup() {
  local tmp="$1"
  mkdir -p \
    "$tmp/.grok/sessions/fleet/sid-unique" \
    "$tmp/.grok/sessions/fleet/sid-cron" \
    "$tmp/.grok/sessions/fleet/sid-old" \
    "$tmp/.claude/projects/-home-revfleet" \
    "$tmp/.local/share/revealui/recovery" \
    "$tmp/.local/share/revealui/coordination/snapshots"
  python3 - "$tmp" <<'PY'
import json, sys, time
from pathlib import Path
from datetime import datetime, timezone, timedelta

root = Path(sys.argv[1])
now = datetime.now(timezone.utc)
old = now - timedelta(hours=90)

def write_summary(p, sid, title, ts, cwd="/home/u/revfleet"):
    p.mkdir(parents=True, exist_ok=True)
    (p / "summary.json").write_text(json.dumps({
        "info": {"id": sid, "cwd": cwd},
        "generated_title": title,
        "session_summary": title,
        "last_active_at": ts.isoformat().replace("+00:00", "Z"),
        "updated_at": ts.isoformat().replace("+00:00", "Z"),
        "num_chat_messages": 3,
        "num_messages": 9,
    }), encoding="utf-8")

def write_chat(p, user, asst):
    lines = [
        json.dumps({"role": "user", "content": user}),
        json.dumps({"role": "assistant", "content": asst}),
    ]
    (p / "chat_history.jsonl").write_text("\n".join(lines) + "\n", encoding="utf-8")

u = root / ".grok/sessions/fleet/sid-unique"
write_summary(u, "sid-unique", "Studio connect agent", now)
write_chat(u, "fix studio connect", "Open https://github.com/RevealUIStudio/revdev/pull/427")

c = root / ".grok/sessions/fleet/sid-cron"
write_summary(c, "sid-cron", "Release train watch: PRs 2648/2647 deploy", now)
write_chat(c, "watch deploys", "still pending")

o = root / ".grok/sessions/fleet/sid-old"
write_summary(o, "sid-old", "Ancient leftover", old)
write_chat(o, "old work", "done")

proj = root / ".claude/projects/-home-revfleet"
cron_user = "Using the gh CLI only, list open PRs in RevealUIStudio/revdev"
(proj / "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl").write_text(
    json.dumps({"message": {"role": "user", "content": cron_user}}) + "\n",
    encoding="utf-8",
)
(root / ".local/share/revealui/recovery/grok-design-doc-a6760024.md").write_text(
    "# village path\n", encoding="utf-8"
)
PY
}

test_recover_inventory_summary_counts() {
  local tmp
  tmp="$(make_sandbox)"
  _ri_setup "$tmp"
  local out
  out="$(_ri "$tmp" --hours 72 --summary)"
  if [[ "$out" == *'1 unique'* && "$out" == *'2 cron'* && "$out" == *'1 recovery-artifacts'* && "$out" == *'revealui-recover'* ]]; then
    pass "summary counts unique, cron, artifacts"
  else
    fail "summary counts unique, cron, artifacts" "$out"
  fi
}

test_recover_inventory_full_lists_unique_and_artifact() {
  local tmp
  tmp="$(make_sandbox)"
  _ri_setup "$tmp"
  local out
  out="$(_ri "$tmp" --hours 72)"
  if [[ "$out" == *'sid-unique'* && "$out" == *'RevealUIStudio/revdev#427'* && "$out" == *'grok-design-doc-a6760024.md'* && "$out" != *'sid-old'* ]]; then
    pass "full report lists unique + PR + artifact, drops old"
  else
    fail "full report lists unique + PR + artifact, drops old" "$out"
  fi
}

test_recover_inventory_collapses_cron() {
  local tmp
  tmp="$(make_sandbox)"
  _ri_setup "$tmp"
  local out
  out="$(_ri "$tmp" --hours 72)"
  if [[ "$out" == *'Collapsed cron / watchers (2)'* && "$out" != *'Release train watch: PRs'* ]]; then
    pass "cron rows collapsed, not listed as unique"
  else
    fail "cron rows collapsed, not listed as unique" "$out"
  fi
}

test_recover_inventory_redacts_jwt_shaped() {
  local tmp
  tmp="$(make_sandbox)"
  _ri_setup "$tmp"
  python3 - "$tmp" <<'PY'
import json, sys
from pathlib import Path
root = Path(sys.argv[1])
chat = root / ".grok/sessions/fleet/sid-unique/chat_history.jsonl"
chat.write_text(
    json.dumps({"role": "user", "content": "here eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaaabbbbbcccccdddddeeeee"})
    + "\n"
    + json.dumps({"role": "assistant", "content": "ok"})
    + "\n",
    encoding="utf-8",
)
PY
  local out
  out="$(_ri "$tmp" --hours 72)"
  if [[ "$out" == *'[redacted]'* && "$out" != *'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'* ]]; then
    pass "jwt-shaped last_user redacted"
  else
    fail "jwt-shaped last_user redacted" "$out"
  fi
}
