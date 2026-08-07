# shellcheck shell=bash
# GAP-342: best-effort dual-write to RevDev session.snapshot.* RPC
# Sourced from session-state.sh. Filesystem under REVEALUI_COORD_ROOT remains
# SSOT for skills. Daemon store is additive when the socket is up, Pro-licensed,
# and an agent is bound. Never hard-fails the skill: prints "ok|skipped|error:…"

# JSON-RPC call over the harness Unix socket. Args: method [json-params-object]
# Prints result JSON on stdout. Returns non-zero on transport/RPC error.
ss_daemon_rpc() {
  local method="${1:-}"
  local params_json="${2:-{}}"
  [ -n "$method" ] || {
    printf 'ss_daemon_rpc: method required\n' >&2
    return 1
  }
  command -v python3 >/dev/null 2>&1 || {
    printf 'ss_daemon_rpc: python3 required\n' >&2
    return 1
  }
  ss_daemon_alive || {
    printf 'ss_daemon_rpc: daemon socket missing\n' >&2
    return 1
  }

  REVEALUI_SOCKET="$DAEMON_SOCKET" python3 - "$method" "$params_json" <<'PY'
import json, os, socket, sys

method, params_raw = sys.argv[1], sys.argv[2]
sock_path = os.environ.get("REVEALUI_SOCKET") or os.path.expanduser(
    "~/.local/share/revealui/harness.sock"
)
try:
    params = json.loads(params_raw) if params_raw else {}
except json.JSONDecodeError as e:
    print(f"invalid params json: {e}", file=sys.stderr)
    sys.exit(2)
req = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
payload = (json.dumps(req, separators=(",", ":")) + "\n").encode()
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.settimeout(8.0)
try:
    s.connect(sock_path)
    s.sendall(payload)
    buf = b""
    while b"\n" not in buf:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
finally:
    s.close()
line = buf.split(b"\n", 1)[0].decode("utf-8", errors="replace")
if not line.strip():
    print("empty response", file=sys.stderr)
    sys.exit(3)
try:
    resp = json.loads(line)
except json.JSONDecodeError as e:
    print(f"bad response: {e}", file=sys.stderr)
    sys.exit(3)
if "error" in resp and resp["error"]:
    err = resp["error"]
    code = err.get("code", "?")
    msg = err.get("message", "unknown")
    print(f"rpc error {code}: {msg}", file=sys.stderr)
    sys.exit(4)
print(json.dumps(resp.get("result"), separators=(",", ":")))
PY
}

# Parse a GAP-317/469 snapshot markdown file into JSON sections for the daemon.
# Maps ## Resume-From-Here → resumeFromHere (and siblings). Prints JSON object.
ss_snapshot_sections_json() {
  local path="${1:-}"
  if [ -z "$path" ] || [ ! -f "$path" ]; then
    printf 'ss_snapshot_sections_json: file required\n' >&2
    return 1
  fi
  command -v python3 >/dev/null 2>&1 || {
    printf 'ss_snapshot_sections_json: python3 required\n' >&2
    return 1
  }
  python3 - "$path" <<'PY'
import json, re, sys

path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
# Drop YAML frontmatter if present
if text.startswith("---"):
    end = text.find("\n---", 3)
    if end != -1:
        text = text[end + 4 :]

heading_to_key = {
    "resume-from-here": "resumeFromHere",
    "what-shipped": "whatShipped",
    "active-constraints": "activeConstraints",
    "do-not-repeat": "doNotRepeat",
    "open-loose-ends": "openLooseEnds",
}
for k in list(heading_to_key.values()):
    heading_to_key[k.lower()] = k

sections = {
    "resumeFromHere": "",
    "whatShipped": "",
    "activeConstraints": "",
    "doNotRepeat": "",
    "openLooseEnds": "",
}
current = None
body_lines = []


def flush():
    global current, body_lines
    if current is None:
        return
    sections[current] = "\n".join(body_lines).strip()
    body_lines = []


for line in text.splitlines():
    m = re.match(r"^##\s+(.+?)\s*$", line)
    if m:
        flush()
        raw = m.group(1).strip()
        key = heading_to_key.get(raw.lower().replace(" ", "-"))
        if key is None:
            slug = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
            key = heading_to_key.get(slug)
        current = key
        continue
    if current is not None:
        body_lines.append(line)
flush()

if not any(v.strip() for v in sections.values()):
    print("no fidelity sections found", file=sys.stderr)
    sys.exit(1)
print(json.dumps(sections, separators=(",", ":")))
PY
}

# Best-effort dual-write: filesystem path → daemon session.snapshot.write.
# Args: [markdown-path] [session-id]
# Env: DAEMON_SOCKET / REVEALUI_SOCKET; REVDEV_ACTOR_AGENT_ID (optional bind)
# Exit 0 on ok or intentional skip; 1 only on unexpected local failure.
# Prints a one-line status: ok:…|skipped:…|error:…
ss_daemon_snapshot_write() {
  local path="${1:-}"
  local sid="${2:-}"

  if [ -z "$path" ]; then
    path="$(ss_snapshot_path 2>/dev/null)" || true
  fi
  if [ -z "$path" ] || [ ! -f "$path" ]; then
    printf 'skipped: no snapshot file\n'
    return 0
  fi
  if [ -z "$sid" ]; then
    sid="$(ss_session_id 2>/dev/null)" || true
  fi
  if [ -z "$sid" ]; then
    sid="$(awk '/^session_id:/{print $2; exit}' "$path" 2>/dev/null | tr -d '[:space:]')"
  fi
  if [ -z "$sid" ]; then
    printf 'skipped: no session id\n'
    return 0
  fi

  if ! ss_daemon_alive; then
    printf 'skipped: daemon socket not present\n'
    return 0
  fi

  local sections
  if ! sections="$(ss_snapshot_sections_json "$path" 2>/dev/null)"; then
    printf 'skipped: could not parse five-section shape\n'
    return 0
  fi

  local agent="${REVDEV_ACTOR_AGENT_ID:-${REVEALUI_AGENT_ID:-skill-snapshot}}"
  # Best-effort register so requireVerifiedAgent can bind a daemon-minted id.
  ss_daemon_rpc "session.register" \
    "$(python3 -c 'import json,sys; print(json.dumps({"agentId":sys.argv[1],"agentName":sys.argv[1],"task":"GAP-342 skill dual-write"}))' "$agent")" \
    >/dev/null 2>&1 || true

  local params result
  params="$(
    python3 -c '
import json, sys
sid, agent, sections = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
print(json.dumps({
  "sessionId": sid,
  "actorAgentId": agent,
  "sections": sections,
  "mechanical": {"source": "revskills/ss_daemon_snapshot_write", "path": sys.argv[4]},
}, separators=(",", ":")))
' "$sid" "$agent" "$sections" "$path"
  )" || {
    printf 'error: failed to build write params\n'
    return 1
  }

  if result="$(ss_daemon_rpc "session.snapshot.write" "$params" 2>/dev/null)"; then
    printf 'ok:%s\n' "$result"
    return 0
  fi
  printf 'skipped: session.snapshot.write failed (Pro license + agent bind may be required)\n'
  return 0
}

# Best-effort read by session id (id-match). Prints snapshot JSON or fails.
ss_daemon_snapshot_get() {
  local sid="${1:-}"
  if [ -z "$sid" ]; then
    sid="$(ss_session_id 2>/dev/null)" || true
  fi
  [ -n "$sid" ] || return 1
  ss_daemon_alive || return 1
  local agent="${REVDEV_ACTOR_AGENT_ID:-${REVEALUI_AGENT_ID:-skill-snapshot}}"
  local params
  params="$(python3 -c 'import json,sys; print(json.dumps({"sessionId":sys.argv[1],"actorAgentId":sys.argv[2]},separators=(",",":")))' "$sid" "$agent")"
  ss_daemon_rpc "session.snapshot.get" "$params"
}
