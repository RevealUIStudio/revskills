#!/usr/bin/env node
/**
 * Live coordination packet (GAP-494).
 *
 * Modes:
 *   report   — read-only roster + claims (snapshot)
 *   refresh  — overwrite this session's workboard.d/active row
 *   full     — report + refresh; --bots prints a grok-bot-handoff facts block
 *
 * Never commits. Never talks to cloud bots. Writes only this session's
 * active fragment.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = process.env.HOME || os.homedir();
const GROK_HOME = process.env.GROK_HOME || path.join(HOME, ".grok");
const FLEET =
  process.env.REVEALFLEET_ROOT ||
  process.env.REVFLEET_ROOT ||
  path.join(HOME, "revealfleet");
const JV = process.env.JV_REPO || path.join(FLEET, ".jv");

function parseArgs(argv) {
  const out = {
    mode: "full",
    bots: false,
    json: false,
    claim: "",
    stayOff: [],
    id: "",
    task: "",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--bots") out.bots = true;
    else if (a === "--mode") out.mode = String(argv[++i] || "full");
    else if (a.startsWith("--mode=")) out.mode = a.slice("--mode=".length);
    else if (a === "--claim") out.claim = String(argv[++i] || "");
    else if (a.startsWith("--claim=")) out.claim = a.slice("--claim=".length);
    else if (a === "--id") out.id = String(argv[++i] || "");
    else if (a.startsWith("--id=")) out.id = a.slice("--id=".length);
    else if (a === "--task") out.task = String(argv[++i] || "");
    else if (a.startsWith("--task=")) out.task = a.slice("--task=".length);
    else if (a === "--stay-off") out.stayOff.push(String(argv[++i] || ""));
    else if (a.startsWith("--stay-off=")) out.stayOff.push(a.slice("--stay-off=".length));
  }
  if (out.mode !== "report" && out.mode !== "refresh" && out.mode !== "full") {
    out.mode = "full";
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function ageLabel(iso) {
  if (!iso) return "?";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "?";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function loadRoster() {
  const data = readJson(path.join(GROK_HOME, "active_sessions.json"));
  if (!Array.isArray(data)) return [];
  const rows = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    rows.push({
      session_id: String(row.session_id || ""),
      pid: Number(row.pid) || 0,
      cwd: String(row.cwd || ""),
      opened_at: String(row.opened_at || ""),
      age: ageLabel(row.opened_at),
    });
  }
  return rows;
}

function loadClaims() {
  const dir = path.join(JV, ".revealui", "workboard.d", "active");
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const claims = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    let body = "";
    try {
      body = fs.readFileSync(path.join(dir, name), "utf8").trim();
    } catch {
      continue;
    }
    claims.push({
      file: name,
      id: name.slice(0, name.length - 3),
      body,
    });
  }
  return claims;
}

function thisSid(args) {
  if (args.id) return args.id;
  if (process.env.AGENT_SESSION_ID) return process.env.AGENT_SESSION_ID;
  if (process.env.REVEALUI_SESSION_ID) return process.env.REVEALUI_SESSION_ID;
  if (process.env.GROK_SESSION_ID) return process.env.GROK_SESSION_ID;
  return "";
}

function overlap(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al.includes(bl) || bl.includes(al);
}

function findConflicts(roster, claims, sid, claim) {
  const out = [];
  const mine = sid || "";
  for (const c of claims) {
    if (c.id === mine || c.id === `grok-${mine}` || c.file === `${mine}.md`) continue;
    if (claim && overlap(c.body, claim)) {
      out.push({ kind: "claim", with: c.id, detail: c.body });
    }
  }
  const myCwd = (roster.find((r) => r.session_id === mine) || {}).cwd || "";
  if (myCwd) {
    for (const r of roster) {
      if (r.session_id === mine) continue;
      if (r.cwd === myCwd) {
        out.push({ kind: "cwd", with: r.session_id, detail: r.cwd });
      }
    }
  }
  return out;
}

function activeRow(args, sid) {
  const id = sid || args.id || "grok";
  const iso = new Date().toISOString().slice(0, 10);
  const claim = args.claim || args.task || "(unclaimed)";
  const stay = args.stayOff.length > 0 ? `stay off: ${args.stayOff.join("; ")}` : "";
  const bits = [claim, stay].filter(Boolean).join(" — ");
  return `| ${id} | WSL Grok | ${claim} | ${iso} | ${bits} |`;
}

function writeActive(args, sid) {
  const id = sid || args.id || "grok";
  const dir = path.join(JV, ".revealui", "workboard.d", "active");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.md`);
  fs.writeFileSync(file, `${activeRow(args, id)}\n`, "utf8");
  return file;
}

function botsBlock(packet) {
  const lines = [
    "GROK-BOT FACTS (paste into grok-bot-handoff; never a pickup fence)",
    `peers: ${packet.roster.length}`,
    `this: ${packet.sid || "(unknown)"}`,
  ];
  if (packet.claim) lines.push(`claim: ${packet.claim}`);
  if (packet.stayOff.length) lines.push(`stay-off: ${packet.stayOff.join("; ")}`);
  for (const c of packet.conflicts) {
    lines.push(`conflict: ${c.kind} with ${c.with}`);
  }
  lines.push("do-not: steal a named GAP another session owns; do not merge; do not --admin");
  return lines.join("\n");
}

function printHuman(packet) {
  const lines = [
    "=== COORDINATE ===",
    `mode: ${packet.mode}`,
    `this: ${packet.sid || "(unknown sid)"}`,
    `peers (grok active_sessions): ${packet.roster.length}`,
  ];
  for (const r of packet.roster) {
    lines.push(`  - ${r.session_id} pid=${r.pid} ${r.age} ${r.cwd}`);
  }
  lines.push(`claims (workboard.d/active): ${packet.claims.length}`);
  for (const c of packet.claims) {
    const one = c.body.split("\n")[0];
    lines.push(`  - ${c.id}: ${one}`);
  }
  if (packet.conflicts.length === 0) {
    lines.push("conflicts: none");
  } else {
    lines.push("conflicts:");
    for (const c of packet.conflicts) {
      lines.push(`  - ${c.kind} with ${c.with}: ${c.detail}`);
    }
  }
  if (packet.wrote) lines.push(`wrote: ${packet.wrote}`);
  if (packet.botsText) {
    lines.push("");
    lines.push(packet.botsText);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  const sid = thisSid(args);
  const roster = loadRoster();
  const claims = loadClaims();
  const claim = args.claim || args.task;
  const conflicts = findConflicts(roster, claims, sid, claim);
  const packet = {
    mode: args.mode,
    sid,
    roster,
    claims,
    conflicts,
    claim,
    stayOff: args.stayOff,
    wrote: "",
    botsText: "",
  };

  if (args.mode === "refresh" || args.mode === "full") {
    packet.wrote = writeActive(args, sid || "grok");
  }
  if (args.bots && args.mode === "full") {
    packet.botsText = botsBlock(packet);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
  } else {
    printHuman(packet);
  }
}

main();
