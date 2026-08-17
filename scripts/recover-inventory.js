#!/usr/bin/env node
/**
 * Historical session inventory for revealui-recover.
 *
 * Default (full): markdown work list the recover skill MUST classify.
 * --summary: one SessionStart line (no chat parse, no git).
 *
 * Usage:
 *   node scripts/recover-inventory.js [--hours 72] [--summary]
 *
 * Always exits 0. Never prints secret values, JWTs, or vault paths' contents.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = process.env.HOME || os.homedir();
const HOURS = parseHours(process.argv);
const SUMMARY = process.argv.includes("--summary");
const NOW = Date.now();
const CUTOFF = NOW - HOURS * 3600 * 1000;

const CRON_USER_PREFIX = "Using the gh CLI only, list open PRs";
const CRON_TITLE_PREFIX = "Release train watch";

function parseHours(argv) {
  const i = argv.indexOf("--hours");
  if (i === -1) return 72;
  const n = Number(argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : 72;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function parseIso(s) {
  if (!s || typeof s !== "string") return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function looksSecret(s) {
  return /-----BEGIN |eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|postgresql:\/\/[^:]+:[^@]+@/i.test(
    s,
  );
}

function safeClip(s, n) {
  const t = clip(s, n);
  if (looksSecret(t)) return "[redacted]";
  return t;
}

function walkSummaries(root, acc) {
  if (!fs.existsSync(root)) return;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = path.join(root, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "archive") continue;
      walkSummaries(p, acc);
    } else if (ent.name === "summary.json") {
      acc.push(p);
    }
  }
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const bits = [];
  for (const c of content) {
    if (typeof c === "string") bits.push(c);
    else if (c && typeof c === "object" && (c.type === "text" || c.type === "input_text")) {
      bits.push(c.text || "");
    }
  }
  return bits.join("\n");
}

function lastUserAndAsst(chatPath) {
  let lastUser = "";
  let lastAsst = "";
  if (!fs.existsSync(chatPath)) return { lastUser, lastAsst };
  let raw;
  try {
    raw = fs.readFileSync(chatPath, "utf8");
  } catch {
    return { lastUser, lastAsst };
  }
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = obj.message && typeof obj.message === "object" ? obj.message : obj;
    const role = obj.role || obj.type || msg.role;
    const text = extractText(msg.content != null ? msg.content : obj.content || obj.text);
    const t = text.trim();
    if (!t || t.startsWith("<") || t.slice(0, 80).includes("command-name")) continue;
    if (role === "user" || role === "human") lastUser = t;
    else if (role === "assistant" || role === "model") lastAsst = t;
  }
  return { lastUser, lastAsst };
}

function mentionedPrs(...texts) {
  const found = new Set();
  const blob = texts.join("\n");
  const re =
    /https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/pull\/(\d+)/g;
  let m;
  while ((m = re.exec(blob))) {
    found.add(`${m[1]}#${m[2]}`);
  }
  return [...found].slice(0, 12);
}

function collectGrok() {
  const root = path.join(HOME, ".grok", "sessions");
  const files = [];
  walkSummaries(root, files);
  const rows = [];
  for (const file of files) {
    const data = readJson(file);
    if (!data || typeof data !== "object") continue;
    const info = data.info && typeof data.info === "object" ? data.info : {};
    const last =
      parseIso(data.last_active_at) ||
      parseIso(data.updated_at) ||
      parseIso(data.created_at);
    if (last == null || last < CUTOFF) continue;
    const title = String(data.generated_title || data.session_summary || "").trim();
    const sid = String(info.id || path.basename(path.dirname(file)));
    const cwd = String(info.cwd || "");
    let lastUser = "";
    let lastAsst = "";
    if (!SUMMARY) {
      const parsed = lastUserAndAsst(path.join(path.dirname(file), "chat_history.jsonl"));
      lastUser = parsed.lastUser;
      lastAsst = parsed.lastAsst;
    }
    const cron =
      title.startsWith(CRON_TITLE_PREFIX) || lastUser.startsWith(CRON_USER_PREFIX);
    rows.push({
      adapter: "grok",
      sid,
      cwd,
      title,
      last: new Date(last).toISOString(),
      chat: Number(data.num_chat_messages) || 0,
      cron,
      lastUser,
      lastAsst,
      prs: mentionedPrs(lastUser, lastAsst),
    });
  }
  rows.sort((a, b) => (a.last < b.last ? 1 : -1));
  return rows;
}

function collectClaude() {
  const root = path.join(HOME, ".claude", "projects");
  const rows = [];
  if (!fs.existsSync(root)) return rows;
  let projects;
  try {
    projects = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return rows;
  }
  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const dir = path.join(root, proj.name);
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!name.endsWith(".jsonl")) continue;
      const file = path.join(dir, name);
      let st;
      try {
        st = fs.statSync(file);
      } catch {
        continue;
      }
      if (st.mtimeMs < CUTOFF) continue;
      let lastUser = "";
      if (!SUMMARY) {
        lastUser = lastUserAndAsst(file).lastUser;
      } else {
        // summary: cheap first-line peek for cron collapse only
        lastUser = lastUserAndAsst(file).lastUser;
      }
      const cron = lastUser.startsWith(CRON_USER_PREFIX);
      rows.push({
        adapter: "claude",
        sid: name.replace(/\.jsonl$/, ""),
        cwd: proj.name,
        title: cron ? "PR-watch cron" : clip(lastUser, 80) || "(no user text)",
        last: new Date(st.mtimeMs).toISOString(),
        chat: 0,
        cron,
        lastUser,
        lastAsst: "",
        prs: mentionedPrs(lastUser),
      });
    }
  }
  rows.sort((a, b) => (a.last < b.last ? 1 : -1));
  return rows;
}

function listDirFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => !n.startsWith("."))
      .map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

function globTmp(prefix) {
  const tmp = process.env.TMPDIR || "/tmp";
  try {
    return fs
      .readdirSync(tmp)
      .filter((n) => n.startsWith(prefix))
      .map((n) => path.join(tmp, n));
  } catch {
    return [];
  }
}

function main() {
  const grok = collectGrok();
  const claude = collectClaude();
  const all = [...grok, ...claude];
  const unique = all.filter((r) => !r.cron);
  const cron = all.filter((r) => r.cron);
  const recovery = listDirFiles(path.join(HOME, ".local", "share", "revealui", "recovery"));
  const snaps = listDirFiles(
    path.join(HOME, ".local", "share", "revealui", "coordination", "snapshots"),
  ).filter((p) => p.endsWith(".md"));
  const crashMarkers = [
    ...globTmp("claude-crash-"),
    ...globTmp("claude-last-state-"),
    ...globTmp("revealui-crash-"),
  ];

  if (SUMMARY) {
    const parts = [
      `[recover-inventory] ${HOURS}h: ${unique.length} unique`,
      `${cron.length} cron`,
      `${recovery.length} recovery-artifacts`,
      `${snaps.length} snapshots`,
    ];
    if (unique.length + recovery.length + snaps.length + crashMarkers.length > 0) {
      parts.push("run revealui-recover — do not skip");
    }
    process.stdout.write(`${parts.join(" · ")}\n`);
    return;
  }

  const lines = [];
  lines.push(`# recover-inventory (${HOURS}h)`);
  lines.push("");
  lines.push(
    `unique=${unique.length} cron=${cron.length} recovery-artifacts=${recovery.length} snapshots=${snaps.length} crash-markers=${crashMarkers.length}`,
  );
  lines.push("");
  lines.push(
    "Classify every unique row (done | owner-gated | agent-unfinished | orphan-artifact).",
  );
  lines.push("Verify every mentioned PR with `gh pr view N -R owner/repo` before trusting a tail.");
  lines.push("Do not emit \"No recovery needed\" until unique rows are classified and agent-unfinished is empty or in progress.");
  lines.push("");

  if (recovery.length) {
    lines.push("## Recovery artifacts (not in git)");
    for (const p of recovery) lines.push(`- ${p}`);
    lines.push("");
  }
  if (snaps.length) {
    lines.push("## Active snapshots");
    for (const p of snaps) lines.push(`- ${p}`);
    lines.push("");
  }
  if (crashMarkers.length) {
    lines.push("## Crash / last-state markers");
    for (const p of crashMarkers) lines.push(`- ${p}`);
    lines.push("");
  }

  lines.push("## Unique sessions");
  if (!unique.length) {
    lines.push("(none)");
  }
  for (const r of unique) {
    lines.push("");
    lines.push(`### ${r.adapter} ${r.last.slice(0, 19)}  ${r.title || "(untitled)"}`);
    lines.push(`- sid: ${r.sid}`);
    lines.push(`- cwd: ${r.cwd || "?"}`);
    if (r.chat) lines.push(`- chat_messages: ${r.chat}`);
    if (r.lastUser) lines.push(`- last_user: ${safeClip(r.lastUser, 280)}`);
    if (r.lastAsst) lines.push(`- asst_tail: ${safeClip(r.lastAsst.slice(-220), 220)}`);
    if (r.prs.length) lines.push(`- prs: ${r.prs.join(", ")}`);
    lines.push("- class: (fill: done | owner-gated | agent-unfinished | orphan-artifact)");
  }

  if (cron.length) {
    lines.push("");
    lines.push(`## Collapsed cron / watchers (${cron.length})`);
    const newest = cron[0];
    const oldest = cron[cron.length - 1];
    lines.push(
      `- ${cron.length} rows, newest ${newest.last.slice(0, 19)}, oldest ${oldest.last.slice(0, 19)}`,
    );
    lines.push("- treat as one watcher class, not N recoveries");
  }

  lines.push("");
  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`recover-inventory: ${err instanceof Error ? err.message : err}\n`);
}
process.exit(0);
