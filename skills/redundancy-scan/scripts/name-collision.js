#!/usr/bin/env node
/**
 * name-collision.js — same basename in multiple directories (heuristic for parallel copies).
 *
 * Usage:
 *   node name-collision.js --root <dir> --out findings.jsonl [--min 2] [--prefix name/]
 */
"use strict";

const path = require("path");
const { parseArgs, loadConfig, walkFiles, writeJsonl } = require("./lib.js");

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.root || !args.out) {
    process.stderr.write(
      "Usage: node name-collision.js --root <dir> --out <findings.jsonl> [--min 2] [--config path] [--prefix name/]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const cfg = loadConfig(args.config);
  const excludeSet = new Set(cfg.excludeDirNames || []);
  const textExtSet = new Set(cfg.textExtensions || []);
  const maxBytes = cfg.maxFileBytes || 1_500_000;
  const min = Number(args.min) || 2;
  const rootAbs = path.resolve(args.root);
  const prefix = args.prefix || "";

  // basenames that are almost always fine to repeat
  const allow = new Set([
    "index.ts",
    "index.tsx",
    "index.js",
    "package.json",
    "README.md",
    "tsconfig.json",
    "vitest.config.ts",
    "biome.json",
    ".gitkeep",
    "route.ts",
    "page.tsx",
    "layout.tsx",
    "loading.tsx",
    "error.tsx",
    "SKILL.md",
  ]);

  const byBase = new Map();
  walkFiles(rootAbs, "", excludeSet, textExtSet, maxBytes, ({ rel }) => {
    const base = path.basename(rel);
    if (allow.has(base)) return;
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(prefix + rel);
  });

  const findings = [];
  let id = 0;
  for (const [base, paths] of byBase) {
    if (paths.length < min) continue;
    // ignore if all under same parent type e.g. many route.ts already filtered
    id++;
    findings.push({
      id: `NAME-${String(id).padStart(4, "0")}`,
      class: "basename-collision",
      severity: "info",
      title: `Same basename in ${paths.length} places: ${base}`,
      basename: base,
      paths,
      classification: "unclassified",
      disposition: "review",
      ts: new Date().toISOString(),
    });
  }

  findings.sort((a, b) => b.paths.length - a.paths.length);
  writeJsonl(args.out, findings);
  process.stdout.write(
    JSON.stringify({ root: rootAbs, groups: findings.length, out: path.resolve(args.out) }, null, 2) +
      "\n",
  );
}

main();
