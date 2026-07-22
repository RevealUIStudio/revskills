#!/usr/bin/env node
/**
 * merge-report.js — combine finding JSONL files + write markdown summary.
 *
 * Usage:
 *   node merge-report.js --out-dir run/ --inputs a.jsonl,b.jsonl,c.jsonl
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { parseArgs, ensureDirFor } = require("./lib.js");

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
  if (args.help || !args["out-dir"] || !args.inputs) {
    process.stderr.write(
      "Usage: node merge-report.js --out-dir <dir> --inputs a.jsonl,b.jsonl[,c.jsonl]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const outDir = path.resolve(args["out-dir"]);
  const inputs = String(args.inputs)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const all = [];
  for (const inp of inputs) {
    all.push(...loadJsonl(inp));
  }

  const byClass = {};
  for (const f of all) {
    byClass[f.class] = (byClass[f.class] || 0) + 1;
  }

  const mergedPath = path.join(outDir, "findings.jsonl");
  ensureDirFor(mergedPath);
  const fd = fs.openSync(mergedPath, "w");
  for (const f of all) fs.writeSync(fd, JSON.stringify(f) + "\n");
  fs.closeSync(fd);

  const md = [];
  md.push(`# Redundancy / deprecation scan report`);
  md.push(``);
  md.push(`- generated: ${new Date().toISOString()}`);
  md.push(`- total findings: **${all.length}**`);
  md.push(``);
  md.push(`## By class`);
  md.push(``);
  for (const [k, v] of Object.entries(byClass).sort((a, b) => b[1] - a[1])) {
    md.push(`- \`${k}\`: ${v}`);
  }
  md.push(``);
  md.push(`## Next actions (agent)`);
  md.push(``);
  md.push(`1. Classify each finding: **intentional** vs **accidental** (audit-first mindfulness).`);
  md.push(`2. Accidental + cheap → consolidate in a PR (extend-before-create).`);
  md.push(`3. Accidental + multi-session → file a tracked work unit (gap/lane); link finding ids.`);
  md.push(`4. Deprecation markers without a removal owner → either remove code or file a gap.`);
  md.push(`5. Do not delete intentional duals (decoupling, test isolation, public API facades).`);
  md.push(``);
  md.push(`## Sample (first 40)`);
  md.push(``);
  for (const f of all.slice(0, 40)) {
    const paths = f.paths ? f.paths.slice(0, 4).join(", ") : f.path || "";
    md.push(`- **${f.id}** [${f.class}] ${f.title}`);
    if (paths) md.push(`  - ${paths}${f.paths && f.paths.length > 4 ? " …" : ""}`);
    if (f.line) md.push(`  - L${f.line}: \`${(f.snippet || "").replace(/`/g, "'")}\``);
  }
  md.push(``);
  md.push(`Full machine list: \`findings.jsonl\`.`);
  md.push(``);

  const mdPath = path.join(outDir, "report.md");
  fs.writeFileSync(mdPath, md.join("\n"));

  const summary = {
    total: all.length,
    byClass,
    merged: mergedPath,
    report: mdPath,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main();
