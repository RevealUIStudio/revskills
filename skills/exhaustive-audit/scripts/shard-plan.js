#!/usr/bin/env node
/**
 * shard-plan.js — partition a manifest.jsonl into non-overlapping shards.
 *
 * Target ~target-lines of text per shard (bin packing by line count).
 * Binaries and tiny files still get a path each so coverage is complete.
 *
 * --by-repo (default when 2+ repos are present): never mix repos in a shard.
 * Shard ids become shard-<repo>-000. Single-repo plans keep shard-000 unless
 * --by-repo is forced.
 *
 * Usage:
 *   node shard-plan.js --manifest run/manifest.jsonl --out run/shards.json --target-lines 8000
 *   node shard-plan.js --manifest run/manifest.jsonl --out run/shards.json --by-repo
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { repoIdFromName } = require("./lib/fleet-scope");

function parseArgs(argv) {
  const out = { targetLines: 8000, byRepo: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--target-lines") out.targetLines = Number(argv[++i]) || 8000;
    else if (a === "--by-repo") out.byRepo = true;
    else if (a === "--no-by-repo") out.byRepo = false;
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

function repoOf(row) {
  if (row.repo) return row.repo;
  const first = String(row.path || "").split("/")[0];
  return first || "unknown";
}

function packRows(rows, targetLines, idPrefix) {
  const shards = [];
  let current = { paths: [], lines: 0, files: 0 };
  let idx = 0;

  function flush() {
    if (current.paths.length === 0) return;
    const id = `${idPrefix}${String(idx).padStart(3, "0")}`;
    shards.push({
      id,
      files: current.files,
      lines: current.lines,
      paths: current.paths,
      status: "open",
    });
    idx++;
    current = { paths: [], lines: 0, files: 0 };
  }

  for (const row of rows) {
    if (row.error) {
      current.paths.push(row.path);
      current.files++;
      continue;
    }
    const w = weight(row);
    if (current.paths.length > 0 && current.lines + w > targetLines) {
      flush();
    }
    current.paths.push(row.path);
    current.lines += w;
    current.files++;
  }
  flush();
  return shards;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.manifest || !args.out) {
    process.stderr.write(
      "Usage: node shard-plan.js --manifest <manifest.jsonl> --out <shards.json> [--target-lines N] [--by-repo|--no-by-repo]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const rows = loadManifest(args.manifest);
  const repos = [...new Set(rows.map(repoOf))];
  const byRepo = args.byRepo === null ? repos.length > 1 : args.byRepo;

  let shards;
  if (byRepo) {
    shards = [];
    const groups = new Map();
    for (const row of rows) {
      const repo = repoOf(row);
      if (!groups.has(repo)) groups.set(repo, []);
      groups.get(repo).push(row);
    }
    const repoNames = [...groups.keys()].sort();
    for (const repo of repoNames) {
      const packed = packRows(groups.get(repo), args.targetLines, `shard-${repoIdFromName(repo)}-`);
      for (const sh of packed) {
        sh.repo = repo;
        shards.push(sh);
      }
    }
  } else {
    shards = packRows(rows, args.targetLines, "shard-");
    if (repos.length === 1) {
      for (const sh of shards) sh.repo = repos[0];
    }
  }

  const plan = {
    version: 1,
    targetLines: args.targetLines,
    byRepo,
    shardCount: shards.length,
    totalFiles: rows.length,
    repos,
    shards,
  };

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(plan, null, 2) + "\n");
  process.stdout.write(
    JSON.stringify(
      {
        out: path.resolve(args.out),
        shardCount: shards.length,
        totalFiles: rows.length,
        byRepo,
        repos,
      },
      null,
      2,
    ) + "\n",
  );
}

main();
