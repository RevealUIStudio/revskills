#!/usr/bin/env node
/**
 * hash-dups.js — exact file-content duplicates under a root (sha256 groups).
 *
 * Usage:
 *   node hash-dups.js --root <dir> --out findings.jsonl [--config defaults.json]
 *   node hash-dups.js --root <dir> --out findings.jsonl --prefix revealui/
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { parseArgs, loadConfig, walkFiles, writeJsonl } = require("./lib.js");

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.root || !args.out) {
    process.stderr.write(
      "Usage: node hash-dups.js --root <dir> --out <findings.jsonl> [--config path] [--prefix name/]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const cfg = loadConfig(args.config);
  const excludeSet = new Set(cfg.excludeDirNames || []);
  const textExtSet = new Set(cfg.textExtensions || []);
  const minBytes = cfg.minHashBytes || 32;
  const maxBytes = cfg.maxFileBytes || 1_500_000;
  const rootAbs = path.resolve(args.root);
  const prefix = args.prefix || "";

  const byHash = new Map();
  walkFiles(rootAbs, "", excludeSet, textExtSet, maxBytes, ({ abs, rel, size }) => {
    if (size < minBytes) return;
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      return;
    }
    // skip binary-ish
    for (let i = 0; i < Math.min(buf.length, 8000); i++) {
      if (buf[i] === 0) return;
    }
    const h = crypto.createHash("sha256").update(buf).digest("hex");
    const p = prefix + rel;
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push({ path: p, bytes: size });
  });

  const findings = [];
  let id = 0;
  for (const [sha256, files] of byHash) {
    if (files.length < 2) continue;
    id++;
    findings.push({
      id: `DUP-EXACT-${String(id).padStart(4, "0")}`,
      class: "exact-duplicate",
      severity: "medium",
      title: `Exact duplicate content (${files.length} files)`,
      sha256,
      bytes: files[0].bytes,
      paths: files.map((f) => f.path),
      classification: "unclassified", // intentional | accidental | unclassified
      disposition: "review",
      ts: new Date().toISOString(),
    });
  }

  findings.sort((a, b) => b.paths.length - a.paths.length || b.bytes - a.bytes);
  writeJsonl(args.out, findings);
  process.stdout.write(
    JSON.stringify(
      { root: rootAbs, groups: findings.length, filesInGroups: findings.reduce((n, f) => n + f.paths.length, 0), out: path.resolve(args.out) },
      null,
      2,
    ) + "\n",
  );
}

main();
