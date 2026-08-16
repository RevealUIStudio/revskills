#!/usr/bin/env node
/**
 * coverage-status.js — compare manifest paths to coverage ledger.
 *
 * Exit 0 only if every manifest path has a terminal coverage status.
 *
 * --mode code (default): verified | finding | waived | blocked | skipped-generated
 * --mode md-truth: those plus GAP-407 C3 statuses
 *
 * Code mode refuses verified without a full lines_read span, and finding
 * without finding_ids. Optional --check-hash compares sha256 to the manifest.
 *
 * Usage:
 *   node coverage-status.js --manifest m.jsonl --ledger coverage.jsonl
 *   node coverage-status.js --manifest m.jsonl --ledger coverage.jsonl --mode md-truth
 *   node coverage-status.js --manifest m.jsonl --ledger coverage.jsonl --write-md progress.md
 */
"use strict";

const fs = require("fs");
const path = require("path");

const TERMINAL_CODE = new Set([
  "verified",
  "finding",
  "waived",
  "blocked",
  "skipped-generated",
]);

const TERMINAL_MD_TRUTH = new Set([
  ...TERMINAL_CODE,
  "historical-ok",
  "generated-ok",
  "non-claim",
  "policy-enforced",
  "fact-match",
  "fact-doc-drift",
  "fact-code-drift",
]);

function parseArgs(argv) {
  const out = { mode: "code", checkHash: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--ledger") out.ledger = argv[++i];
    else if (a === "--write-md") out.writeMd = argv[++i];
    else if (a === "--mode") out.mode = argv[++i];
    else if (a === "--check-hash") out.checkHash = true;
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

function terminalsFor(mode) {
  if (mode === "md-truth") return TERMINAL_MD_TRUTH;
  if (mode === "code") return TERMINAL_CODE;
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.manifest || !args.ledger) {
    process.stderr.write(
      "Usage: node coverage-status.js --manifest <m.jsonl> --ledger <coverage.jsonl> [--mode code|md-truth] [--check-hash] [--write-md progress.md]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const terminals = terminalsFor(args.mode);
  if (!terminals) {
    process.stderr.write(`coverage-status: unknown --mode ${args.mode} (code|md-truth)\n`);
    process.exit(1);
  }

  const manifest = loadJsonl(args.manifest);
  const ledgerRows = loadJsonl(args.ledger);

  const byPath = new Map();
  for (const row of ledgerRows) {
    if (row && row.path) byPath.set(row.path, row);
  }

  const missing = [];
  const nonTerminal = [];
  const counts = {};

  for (const m of manifest) {
    const p = m.path;
    const cov = byPath.get(p);
    if (!cov) {
      missing.push(p);
      continue;
    }
    if (!terminals.has(cov.status)) {
      nonTerminal.push({ path: p, status: cov.status || "missing-status" });
      continue;
    }

    if (args.mode === "code" && cov.status === "verified") {
      if (typeof m.lines === "number" && m.lines > 0) {
        if (!Array.isArray(cov.lines_read) || cov.lines_read.length !== 2) {
          nonTerminal.push({ path: p, status: "verified-missing-lines_read" });
          continue;
        }
      }
    }

    if (args.mode === "code" && cov.status === "finding") {
      if (!Array.isArray(cov.finding_ids) || cov.finding_ids.length === 0) {
        nonTerminal.push({ path: p, status: "finding-missing-ids" });
        continue;
      }
    }

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
        continue;
      }
    }

    if (args.checkHash && m.sha256 && cov.sha256 && cov.sha256 !== m.sha256) {
      nonTerminal.push({ path: p, status: "sha256-mismatch" });
      continue;
    }

    counts[cov.status] = (counts[cov.status] || 0) + 1;
  }

  const covered = manifest.length - missing.length - nonTerminal.length;
  const complete = missing.length === 0 && nonTerminal.length === 0;

  const summary = {
    complete,
    mode: args.mode,
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
      `- mode: ${args.mode}`,
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
