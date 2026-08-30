#!/usr/bin/env node
/**
 * Snapshot-before-compact (GAP-317 follow-on).
 *
 * Compaction destroys session fidelity. Agent-authored /snapshot is still the
 * SSOT for checkpoint (a hook cannot write the five narrative sections). This
 * hook is the force path so compaction never runs on an empty snapshot:
 *
 *   stop       — Grok Stop gate. When real occupancy is at/above the snapshot
 *                gate (auto-compact threshold minus headroom) and this session
 *                has no agent-authored $SID.md, block the turn so the agent
 *                MUST run /snapshot before the next prompt can auto-compact.
 *                Grok UserPromptSubmit stdout is discarded, so the Claude
 *                track-session advisory never reaches the Grok model.
 *
 *   precompact — last-ditch mechanical capture. PreCompact is not blocking.
 *                If compact is already firing and no agent snapshot exists,
 *                write a labeled origin:precompact-mechanical $SID.md so
 *                /checkpoint has something keyed to this session.
 *
 * Usage:
 *   node scripts/snapshot-before-compact.js [--mode=stop|precompact]
 *
 * Mode is inferred from GROK_HOOK_EVENT / stdin.hookEventName when omitted.
 * Fail-open: never throw, never block compaction, never invent a session id.
 *
 * Env (tests):
 *   REVEALUI_COORD_ROOT, REVEALUI_SNAPSHOT_GATE_PCT, GROK_HOME, HOME
 */
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = process.env.HOME || os.homedir();
const GROK_HOME = process.env.GROK_HOME || path.join(HOME, ".grok");
const COORD_ROOT =
  process.env.REVEALUI_COORD_ROOT ||
  path.join(HOME, ".local", "share", "revealui", "coordination");
const DEFAULT_COMPACT_PCT = 85;
const DEFAULT_HEADROOM_PCT = 25;
const MIN_GATE_PCT = 50;
const MECHANICAL_ORIGIN = "precompact-mechanical";

function readStdin() {
  try {
    const stat = fs.fstatSync(0);
    if (!stat.isFIFO() && !stat.isSocket() && !stat.isFile()) return {};
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

function sanitizeSid(sid) {
  const t = str(sid);
  if (!t || t.length > 128) return "";
  if (!/^[A-Za-z0-9._-]+$/.test(t)) return "";
  return t;
}

function eventName(payload) {
  return (
    str(process.env.GROK_HOOK_EVENT) ||
    str(payload.hookEventName) ||
    str(payload.hook_event_name) ||
    str(payload.event) ||
    ""
  );
}

function resolveMode(argv, payload) {
  const flag = argv.find((a) => a.startsWith("--mode="));
  if (flag) {
    const m = flag.slice("--mode=".length).toLowerCase();
    if (m === "stop" || m === "precompact") return m;
  }
  const ev = eventName(payload).toLowerCase().replace(/-/g, "_");
  if (ev === "stop" || ev === "pre_stop") return "stop";
  if (ev === "precompact" || ev === "pre_compact") return "precompact";
  return "";
}

function resolveSid(payload) {
  return sanitizeSid(
    payload.sessionId ||
      payload.session_id ||
      process.env.GROK_SESSION_ID ||
      process.env.CLAUDE_CODE_SESSION_ID ||
      process.env.AGENT_SESSION_ID ||
      process.env.REVEALUI_SESSION_ID,
  );
}

function snapshotPath(sid) {
  return path.join(COORD_ROOT, "snapshots", `${sid}.md`);
}

function readFrontmatter(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return { raw: text, fields: {} };
    const fields = {};
    for (const line of m[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) fields[k] = v;
    }
    return { raw: text, fields };
  } catch {
    return null;
  }
}

function hasAgentAuthoredSnapshot(sid) {
  const file = snapshotPath(sid);
  const parsed = readFrontmatter(file);
  if (!parsed) return false;
  return parsed.fields.origin !== MECHANICAL_ORIGIN;
}

function parseCompactThreshold() {
  const envN = Number(process.env.REVEALUI_AUTO_COMPACT_PCT);
  if (Number.isFinite(envN) && envN > 0 && envN <= 100) return envN;
  try {
    const toml = fs.readFileSync(path.join(GROK_HOME, "config.toml"), "utf8");
    const m = toml.match(/auto_compact_threshold_percent\s*=\s*(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 100) return n;
    }
  } catch {
    /* use default */
  }
  return DEFAULT_COMPACT_PCT;
}

function snapshotGatePct() {
  const envN = Number(process.env.REVEALUI_SNAPSHOT_GATE_PCT);
  if (Number.isFinite(envN) && envN > 0 && envN <= 100) return envN;
  return Math.max(MIN_GATE_PCT, parseCompactThreshold() - DEFAULT_HEADROOM_PCT);
}

function contextWindowTokens(signals) {
  const envN = Number(process.env.REVEALUI_CONTEXT_WINDOW_TOKENS);
  if (Number.isFinite(envN) && envN > 0) return envN;
  const fromSignals = Number(signals && signals.contextWindowTokens);
  if (Number.isFinite(fromSignals) && fromSignals > 0) return fromSignals;
  return 500000;
}

function findSessionDir(sid, payload) {
  const sessionsRoot = path.join(GROK_HOME, "sessions");
  const candidates = [];
  const cwd = str(payload.cwd) || str(payload.workspaceRoot) || process.cwd();
  const workspace = str(payload.workspaceRoot) || str(process.env.GROK_WORKSPACE_ROOT);
  for (const root of [workspace, cwd]) {
    if (!root) continue;
    candidates.push(path.join(sessionsRoot, encodeURIComponent(root), sid));
  }
  try {
    for (const dir of fs.readdirSync(sessionsRoot)) {
      candidates.push(path.join(sessionsRoot, dir, sid));
    }
  } catch {
    /* no sessions dir */
  }
  const seen = new Set();
  for (const d of candidates) {
    if (seen.has(d)) continue;
    seen.add(d);
    try {
      if (fs.statSync(d).isDirectory()) return d;
    } catch {
      /* skip */
    }
  }
  return "";
}

function occupancyFromSignals(signals) {
  if (!signals || typeof signals !== "object") return null;
  const used = Number(signals.contextTokensUsed);
  const window = Number(signals.contextWindowTokens);
  if (Number.isFinite(used) && Number.isFinite(window) && window > 0) {
    return Math.min(100, Math.max(0, Math.round((used / window) * 100)));
  }
  const usage = Number(signals.contextWindowUsage);
  if (Number.isFinite(usage) && usage >= 0) {
    return Math.min(100, Math.max(0, Math.round(usage)));
  }
  return null;
}

function occupancyFromDir(dir) {
  if (!dir) return null;
  let signals = null;
  try {
    const p = path.join(dir, "signals.json");
    if (fs.existsSync(p)) signals = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    signals = null;
  }
  const fromSignals = occupancyFromSignals(signals);
  if (fromSignals != null) return fromSignals;
  // Live TUI sessions often have no signals.json. chat_history.jsonl is the
  // raw model-bound transcript. 3 bytes/token overestimates occupancy so the
  // Stop gate fires earlier than auto-compact, not later.
  try {
    const hist = path.join(dir, "chat_history.jsonl");
    const bytes = fs.statSync(hist).size;
    const window = contextWindowTokens(signals);
    if (bytes > 0 && window > 0) {
      return Math.min(100, Math.max(0, Math.round((bytes / 3 / window) * 100)));
    }
  } catch {
    /* no history */
  }
  return null;
}

function gitStatusLine(cwd) {
  if (!cwd) return "cwd unknown";
  try {
    const out = execFileSync("git", ["status", "-sb"], {
      cwd,
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .slice(0, 2000);
    return out || "git status empty";
  } catch {
    return "git status unavailable";
  }
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function writeMechanical(sid, payload, occ, trigger) {
  const dest = snapshotPath(sid);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const cwd = str(payload.cwd) || str(payload.workspaceRoot) || process.cwd();
  const model = str(payload.model) || "unknown";
  const git = gitStatusLine(cwd);
  const occLine = occ == null ? "" : `occupancy-pct: ${occ}\n`;
  const body = `---
session_id: ${sid}
created: ${isoNow()}
model: ${model}
${occLine}origin: ${MECHANICAL_ORIGIN}
compact-trigger: ${trigger || "unknown"}
---

# Snapshot — pre-compact mechanical (agent did not author before compaction)

## Resume-From-Here
Session compacted before an agent-authored /snapshot. Reconstruct from this mechanical capture plus the remaining conversation. Run the revealui-snapshot skill NOW if fidelity is still high enough to replace this file; otherwise /checkpoint from this record.

## What-Shipped
Mechanical cwd git status (hook; not a fleet scan):

\`\`\`
${git}
\`\`\`

## Active-Constraints
origin: precompact-mechanical. A hook wrote this last-ditch record because compaction was already firing and no agent-authored snapshot existed for this session id. Do not treat this as high-fidelity narrative.

## Do-Not-Repeat
Do not let compaction run without an agent-authored /snapshot. The Stop gate should have blocked at the occupancy gate.

## Open-Loose-Ends
Replace this mechanical file with a real /snapshot if the remainder of the session still holds the work. Checkpoint should note origin:precompact-mechanical (lower fidelity).
`;
  fs.writeFileSync(dest, body, "utf8");
  return dest;
}

function stopShouldSkip(payload) {
  if (str(payload.subagentType) || str(payload.subagent_type)) return "subagent";
  const reason = str(payload.reason) || "end_turn";
  if (reason !== "end_turn") return `reason:${reason}`;
  return "";
}

function compactTrigger(payload) {
  return (
    str(payload.trigger) ||
    str(payload.compactionTrigger) ||
    str(payload.compaction_trigger) ||
    "unknown"
  );
}

function runStop(payload, sid) {
  const skip = stopShouldSkip(payload);
  if (skip) {
    process.stderr.write(`[snapshot-before-compact] stop skip (${skip})\n`);
    return 0;
  }
  if (!sid) {
    process.stderr.write("[snapshot-before-compact] stop skip (no session id)\n");
    return 0;
  }
  if (hasAgentAuthoredSnapshot(sid)) {
    process.stderr.write(`[snapshot-before-compact] stop allow (agent snapshot ${sid})\n`);
    return 0;
  }
  const occ = occupancyFromDir(findSessionDir(sid, payload));
  const gate = snapshotGatePct();
  if (occ == null) {
    process.stderr.write("[snapshot-before-compact] stop skip (occupancy unknown)\n");
    return 0;
  }
  if (occ < gate) {
    process.stderr.write(
      `[snapshot-before-compact] stop allow (occupancy ${occ}% < gate ${gate}%)\n`,
    );
    return 0;
  }
  const reason =
    `BLOCKED: context occupancy ${occ}% (gate ${gate}%; auto-compact follows). ` +
    `Compaction will destroy session fidelity for /checkpoint. ` +
    `Run the revealui-snapshot skill NOW this turn — do not continue other work. ` +
    `Follow ~/revfleet/revskills/skills/revealui-snapshot/SKILL.md and write the ` +
    `five-section snapshot keyed to session ${sid}.`;
  process.stdout.write(
    `${JSON.stringify({
      decision: "block",
      reason,
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: reason,
      },
    })}\n`,
  );
  process.stderr.write(`[snapshot-before-compact] stop block occupancy=${occ}% sid=${sid}\n`);
  return 0;
}

function runPrecompact(payload, sid) {
  if (!sid) {
    process.stderr.write("[snapshot-before-compact] precompact skip (no session id)\n");
    return 0;
  }
  if (hasAgentAuthoredSnapshot(sid)) {
    process.stderr.write(
      `[snapshot-before-compact] precompact skip (agent snapshot ${sid})\n`,
    );
    return 0;
  }
  const occ = occupancyFromDir(findSessionDir(sid, payload));
  const trigger = compactTrigger(payload);
  const dest = writeMechanical(sid, payload, occ, trigger);
  process.stderr.write(
    `[snapshot-before-compact] wrote mechanical ${dest} trigger=${trigger} occupancy=${occ ?? "unknown"}\n`,
  );
  const extra =
    `A mechanical pre-compact snapshot was written for session ${sid} at ${dest} ` +
    `(origin:precompact-mechanical). After compact, run /snapshot to replace it ` +
    `if remaining context still holds the work.`;
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreCompact",
        additionalContext: extra,
      },
    })}\n`,
  );
  return 0;
}

function main(argv) {
  const payload = readStdin();
  const mode = resolveMode(argv, payload);
  const sid = resolveSid(payload);
  if (!mode) {
    process.stderr.write("[snapshot-before-compact] skip (unknown mode)\n");
    return 0;
  }
  if (mode === "stop") return runStop(payload, sid);
  if (mode === "precompact") return runPrecompact(payload, sid);
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (err) {
  process.stderr.write(
    `[snapshot-before-compact] fail-open: ${err && err.message ? err.message : err}\n`,
  );
  process.exit(0);
}
