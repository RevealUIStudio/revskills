#!/usr/bin/env node
/**
 * manifest-build.js — exhaustive path inventory for an audit run.
 *
 * Every file under --root (minus excludes) becomes one JSONL record:
 *   path, abs, bytes, lines, sha256, ext, kind, repo
 *
 * Completeness is machine-checked later via coverage-status.js.
 *
 * Usage:
 *   node manifest-build.js --root ~/revfleet/revealui --out /path/manifest.jsonl
 *   node manifest-build.js --root ~/revfleet --fleet --exclude-defaults --out /path/manifest.jsonl
 *   node manifest-build.js --root ~/revfleet --fleet --include-archive --out /path/manifest.jsonl
 *   node manifest-build.js --root . --exclude-defaults --exclude '.pgdata/**'
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  resolveFleetAllowlist,
  shouldWalkFleetChild,
} = require("./lib/fleet-scope");

const DEFAULT_EXCLUDES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  "opensrc",
  ".direnv",
  "target",
  "vendor",
  "playwright-report",
  "test-results",
  "e2e-results",
  "accessibility-results",
  "visual-results",
  "coverage-reports",
  ".pgdata",
  ".playwright-mcp",
  "result",
];

function parseArgs(argv) {
  const out = {
    exclude: [],
    excludeDefaults: false,
    fleet: false,
    includeArchive: false,
    repos: [],
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") out.root = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--exclude-defaults") out.excludeDefaults = true;
    else if (a === "--exclude") out.exclude.push(argv[++i]);
    else if (a === "--fleet") out.fleet = true;
    else if (a === "--include-archive") out.includeArchive = true;
    else if (a === "--repos") {
      const raw = argv[++i] || "";
      out.repos = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function usage() {
  process.stderr.write(
    "Usage: node manifest-build.js --root <dir> --out <manifest.jsonl> [--exclude-defaults] [--exclude name]... [--fleet] [--include-archive] [--repos a,b]\n",
  );
}

function shouldSkipDir(name, excludeSet) {
  if (excludeSet.has(name)) return true;
  if (name === "node_modules" || name === ".git") return true;
  return false;
}

function classify(rel, ext) {
  const base = path.basename(rel);
  if (base === "package.json" || base === "pnpm-lock.yaml" || base === "Cargo.toml")
    return "manifest";
  if (ext === ".md" || ext === ".mdx") return "doc";
  if (ext === ".yml" || ext === ".yaml" || ext === ".toml" || ext === ".json" || ext === ".jsonc")
    return "config";
  if (
    ext === ".ts" ||
    ext === ".tsx" ||
    ext === ".js" ||
    ext === ".jsx" ||
    ext === ".mjs" ||
    ext === ".cjs"
  )
    return "code";
  if (ext === ".rs" || ext === ".go" || ext === ".py" || ext === ".sh" || ext === ".ps1")
    return "code";
  if (ext === ".sql") return "schema";
  if (ext === ".css" || ext === ".scss") return "style";
  if (base.startsWith(".env")) return "env";
  return "other";
}

function countLines(buf) {
  if (buf.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 10) n++;
  }
  if (buf[buf.length - 1] === 10) n--;
  if (n < 1) n = 1;
  return n;
}

function isProbablyBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function walk(rootAbs, relBase, excludeSet, records, repo) {
  let entries;
  try {
    entries = fs.readdirSync(rootAbs, { withFileTypes: true });
  } catch (err) {
    process.stderr.write(`manifest-build: skip unreadable dir ${rootAbs}: ${err.message}\n`);
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (ent.isDirectory()) {
      if (shouldSkipDir(name, excludeSet)) continue;
      walk(path.join(rootAbs, name), path.join(relBase, name), excludeSet, records, repo);
      continue;
    }
    if (!ent.isFile()) continue;
    const abs = path.join(rootAbs, name);
    const rel = path.join(relBase, name).split(path.sep).join("/");
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch (err) {
      records.push({
        path: rel,
        abs,
        error: String(err.message),
        kind: "unreadable",
        repo,
      });
      continue;
    }
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const ext = path.extname(name).toLowerCase();
    const binary = isProbablyBinary(buf);
    const lines = binary ? null : countLines(buf);
    records.push({
      path: rel,
      abs,
      bytes: buf.length,
      lines,
      sha256,
      ext,
      kind: binary ? "binary" : classify(rel, ext),
      binary,
      repo,
    });
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.root || !args.out) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const rootAbs = path.resolve(args.root);
  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
    process.stderr.write(`manifest-build: not a directory: ${rootAbs}\n`);
    process.exit(1);
  }

  const excludeSet = new Set(args.exclude);
  if (args.excludeDefaults) {
    for (const x of DEFAULT_EXCLUDES) excludeSet.add(x);
  }

  const records = [];
  const walked = [];
  if (args.fleet) {
    const allow = resolveFleetAllowlist({
      repos: args.repos,
      includeArchive: args.includeArchive,
    });
    const kids = fs.readdirSync(rootAbs, { withFileTypes: true });
    for (const ent of kids) {
      if (!ent.isDirectory()) continue;
      if (!shouldWalkFleetChild(ent.name, allow)) continue;
      walked.push(ent.name);
      walk(path.join(rootAbs, ent.name), ent.name, excludeSet, records, ent.name);
    }
  } else {
    const repo = path.basename(rootAbs);
    walked.push(repo);
    walk(rootAbs, "", excludeSet, records, repo);
  }

  records.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  const outAbs = path.resolve(args.out);
  const fd = fs.openSync(outAbs, "w");
  let totalLines = 0;
  let totalBytes = 0;
  for (const r of records) {
    fs.writeSync(fd, JSON.stringify(r) + "\n");
    if (typeof r.lines === "number") totalLines += r.lines;
    if (typeof r.bytes === "number") totalBytes += r.bytes;
  }
  fs.closeSync(fd);

  process.stdout.write(
    JSON.stringify(
      {
        root: rootAbs,
        out: outAbs,
        files: records.length,
        totalLines,
        totalBytes,
        fleet: Boolean(args.fleet),
        repos: walked,
        exclude: [...excludeSet],
      },
      null,
      2,
    ) + "\n",
  );
}

main();
