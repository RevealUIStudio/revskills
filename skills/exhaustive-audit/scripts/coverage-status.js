#!/usr/bin/env node
/**
 * coverage-status.js — compare manifest paths to coverage ledger.
 *
 * Exit 0 only if every manifest path has a terminal coverage status.
 * Terminal: verified | finding | waived | blocked | skipped-generated
 *
 * Usage:
 *   node coverage-status.js --manifest m.jsonl --ledger coverage.jsonl
 *   node coverage-status.js --manifest m.jsonl --ledger coverage.jsonl --write-md progress.md
 */
"use strict";

const fs = require("fs");
const path = require("path");

const TERMINAL = new Set([
  "verified",
  "finding",
  "waived",
  "blocked",
  "skipped-generated",
  // GAP-407 C3 statuses (W1 auto-class)
  "historical-ok",
  "generated-ok",
  "non-claim",
  "policy-enforced",
  "fact-match",
  "fact-doc-drift",
  "fact-code-drift",
]);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--ledger") out.ledger = argv[++i];
    else if (a === "--write-md") out.writeMd = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function loadJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.manifest || !args.ledger) {
    process.stderr.write(
      "Usage: node coverage-status.js --manifest <m.jsonl> --ledger <coverage.jsonl> [--write-md progress.md]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const manifest = loadJsonl(args.manifest);
  const ledgerRows = loadJsonl(args.ledger);

  // last write wins per path
  const byPath = new Map();
  for (const row of ledgerRows) {
    if (row && row.path) byPath.set(row.path, row);
  }

  const missing = [];
  const nonTerminal = [];
  const counts = {
    verified: 0,
    finding: 0,
    waived: 0,
    blocked: 0,
    "skipped-generated": 0,
  };

  for (const m of manifest) {
    const p = m.path;
    const cov = byPath.get(p);
    if (!cov) {
      missing.push(p);
      continue;
    }
    if (!TERMINAL.has(cov.status)) {
      nonTerminal.push({ path: p, status: cov.status });
      continue;
    }
    counts[cov.status] = (counts[cov.status] || 0) + 1;

    // line accountability when both sides have numbers
    if (
      typeof m.lines === "number" &&
      Array.isArray(cov.lines_read) &&
      cov.lines_read.length === 2
    ) {
      const [a, b] = cov.lines_read;
      const span = b - a + 1;
      if (span < m.lines && cov.status !== "blocked") {
        nonTerminal.push({
          path: p,
          status: `line-gap manifest=${m.lines} read_span=${span}`,
        });
      }
    }
  }

  const covered = manifest.length - missing.length - nonTerminal.length;
  const complete = missing.length === 0 && nonTerminal.length === 0;

  const summary = {
    complete,
    manifestFiles: manifest.length,
    covered,
    missing: missing.length,
    nonTerminal: nonTerminal.length,
    counts,
    sampleMissing: missing.slice(0, 20),
    sampleNonTerminal: nonTerminal.slice(0, 20),
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  if (args.writeMd) {
    const lines = [
      `# Audit coverage`,
      ``,
      `- complete: **${complete}**`,
      `- manifest files: ${manifest.length}`,
      `- covered (terminal): ${covered}`,
      `- missing: ${missing.length}`,
      `- non-terminal / line-gap: ${nonTerminal.length}`,
      ``,
      `## Status counts`,
      ``,
    ];
    for (const [k, v] of Object.entries(counts)) {
      lines.push(`- ${k}: ${v}`);
    }
    if (missing.length) {
      lines.push(``, `## Missing (first 50)`, ``);
      for (const p of missing.slice(0, 50)) lines.push(`- \`${p}\``);
    }
    fs.mkdirSync(path.dirname(path.resolve(args.writeMd)), { recursive: true });
    fs.writeFileSync(args.writeMd, lines.join("\n") + "\n");
  }

  process.exit(complete ? 0 : 1);
}

main();
