#!/usr/bin/env node
/**
 * shard-plan.js — partition a manifest.jsonl into non-overlapping shards.
 *
 * Target ~target-lines of text per shard (bin packing by line count).
 * Binaries and tiny files still get a path each so coverage is complete.
 *
 * Usage:
 *   node shard-plan.js --manifest run/manifest.jsonl --out run/shards.json --target-lines 8000
 */
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = { targetLines: 8000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--target-lines") out.targetLines = Number(argv[++i]) || 8000;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function loadManifest(file) {
  const text = fs.readFileSync(file, "utf8");
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  return rows;
}

function weight(row) {
  if (typeof row.lines === "number" && row.lines > 0) return row.lines;
  if (row.binary) return 1;
  if (typeof row.bytes === "number") return Math.max(1, Math.ceil(row.bytes / 40));
  return 1;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.manifest || !args.out) {
    process.stderr.write(
      "Usage: node shard-plan.js --manifest <manifest.jsonl> --out <shards.json> [--target-lines N]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const rows = loadManifest(args.manifest);
  const shards = [];
  let current = { id: null, paths: [], lines: 0, files: 0 };
  let idx = 0;

  function flush() {
    if (current.paths.length === 0) return;
    current.id = `shard-${String(idx).padStart(3, "0")}`;
    shards.push({
      id: current.id,
      files: current.files,
      lines: current.lines,
      paths: current.paths,
      status: "open",
    });
    idx++;
    current = { id: null, paths: [], lines: 0, files: 0 };
  }

  for (const row of rows) {
    if (row.error) {
      // still must be audited as blocked
      current.paths.push(row.path);
      current.files++;
      continue;
    }
    const w = weight(row);
    if (current.paths.length > 0 && current.lines + w > args.targetLines) {
      flush();
    }
    current.paths.push(row.path);
    current.lines += w;
    current.files++;
  }
  flush();

  const plan = {
    version: 1,
    targetLines: args.targetLines,
    shardCount: shards.length,
    totalFiles: rows.length,
    shards,
  };

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(plan, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify(
      { out: path.resolve(args.out), shardCount: shards.length, totalFiles: rows.length },
      null,
      2,
    ) + "\n",
  );
}

main();
