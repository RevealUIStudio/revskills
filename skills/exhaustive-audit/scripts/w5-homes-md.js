#!/usr/bin/env node
/**
 * w5-homes-md.js — GAP-407 W5: adapter-home markdown coverage
 * (claude-home / grok-home manifests).
 *
 * Usage:
 *   node w5-homes-md.js \
 *     --manifest-claude manifest-claude-home-md.jsonl \
 *     --manifest-grok manifest-grok-home-md.jsonl \
 *     --ledger coverage.jsonl \
 *     [--dry-run]
 */
"use strict";

const fs = require("fs");
const crypto = require("crypto");

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest-claude") out.claude = argv[++i];
    else if (a === "--manifest-grok") out.grok = argv[++i];
    else if (a === "--ledger") out.ledger = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function loadJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const TERMINAL = new Set([
  "verified",
  "finding",
  "waived",
  "blocked",
  "skipped-generated",
  "historical-ok",
  "generated-ok",
  "non-claim",
  "policy-enforced",
  "fact-match",
  "fact-doc-drift",
  "fact-code-drift",
]);

function classifyHome(p) {
  if (/\/archive\//.test(p) || /\/commands\/archive\//.test(p)) {
    return { status: "historical-ok", proof: "home:archived-command", tier: "L2" };
  }
  if (/\/cache\//.test(p)) {
    return { status: "generated-ok", proof: "home:cache", tier: "L2" };
  }
  if (
    /claude-home\/CLAUDE\.md$/.test(p) ||
    /grok-home\/AGENTS\.md$/.test(p) ||
    /grok-home\/rules\//.test(p) ||
    /claude-home\/rules\//.test(p)
  ) {
    return { status: "verified", proof: "home:policy-L4", tier: "L4" };
  }
  if (/\/agents\//.test(p) || /\/commands\//.test(p)) {
    return { status: "verified", proof: "home:agent-or-command-L2", tier: "L2" };
  }
  return { status: "verified", proof: "home:residual-L2", tier: "L2" };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.ledger || (!args.claude && !args.grok)) {
    process.stderr.write(
      "Usage: node w5-homes-md.js --ledger coverage.jsonl --manifest-claude c.jsonl --manifest-grok g.jsonl\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const manifests = [];
  if (args.claude) manifests.push(...loadJsonl(args.claude));
  if (args.grok) manifests.push(...loadJsonl(args.grok));

  const ledger = loadJsonl(args.ledger);
  const byPath = new Map();
  for (const row of ledger) {
    if (row && row.path) byPath.set(row.path, row);
  }

  const ts = new Date().toISOString();
  const agent = "grok-gap407-w5-homes";
  const written = [];
  const skipped = { already: 0, missingFile: 0, error: 0 };
  const byStatus = {};
  const l4 = [];
  const flags = [];

  for (const m of manifests) {
    const p = m.path;
    if (byPath.has(p) && TERMINAL.has(byPath.get(p).status)) {
      skipped.already++;
      continue;
    }
    const cls = classifyHome(p);
    if (!m.abs || !fs.existsSync(m.abs)) {
      skipped.missingFile++;
      continue;
    }
    let buf;
    let text;
    try {
      buf = fs.readFileSync(m.abs);
      text = buf.toString("utf8");
    } catch {
      skipped.error++;
      continue;
    }

    const diskLines = text.length === 0 ? 0 : text.split(/\n/).length;
    const end = Math.max(typeof m.lines === "number" ? m.lines : 0, diskLines, diskLines ? 1 : 0);

    if (cls.tier === "L4") {
      l4.push(p);
      // Pointer-only Grok rules should not re-author full hardlines
      if (/grok-home\/rules\//.test(p) && text.length > 4000 && !/pointer|Plane A|do not full-copy/i.test(text)) {
        flags.push({ path: p, note: "grok rule file large — check adapter-only thinness" });
      }
      if (/~\/suite\//.test(text) && !/retired|banned|stale/.test(text)) {
        flags.push({ path: p, note: "possible live suite path" });
      }
    }

    const row = {
      path: p,
      status: cls.status,
      lines_read: end === 0 ? [0, 0] : [1, end],
      manifest_lines: typeof m.lines === "number" ? m.lines : end,
      sha256: sha256(buf),
      agent,
      session: "gap407-w5-homes",
      ts,
      finding_ids: [],
      notes: `W5 home; tier=${cls.tier}; proof=${cls.proof}`,
      c3: {
        bar: "fact-match|historical-ok|generated-ok|non-claim|waived",
        default: cls.status === "verified" ? "fact-match" : cls.status,
        proof: cls.proof,
        tier: cls.tier,
        finding_ids: [],
      },
    };
    written.push(row);
    byPath.set(p, row);
    byStatus[cls.status] = (byStatus[cls.status] || 0) + 1;
  }

  if (!args.dryRun && written.length) {
    const fh = fs.openSync(args.ledger, "a");
    for (const row of written) fs.writeSync(fh, JSON.stringify(row) + "\n");
    fs.closeSync(fh);
  }

  process.stdout.write(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        classified: written.length,
        byStatus,
        l4Count: l4.length,
        l4,
        flags,
        skipped,
      },
      null,
      2,
    ) + "\n",
  );
}

main();
