#!/usr/bin/env node
/**
 * marker-scan.js — scan text files for deprecation and redundancy markers.
 *
 * Usage:
 *   node marker-scan.js --root <dir> --out findings.jsonl --mode deprecation
 *   node marker-scan.js --root <dir> --out findings.jsonl --mode redundancy
 *   node marker-scan.js --root <dir> --out findings.jsonl --mode both
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { parseArgs, loadConfig, walkFiles, writeJsonl } = require("./lib.js");

function findLines(text, needles) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    for (const n of needles) {
      if (lower.includes(n.toLowerCase()) || line.includes(n)) {
        hits.push({ line: i + 1, needle: n, text: line.trim().slice(0, 200) });
        break;
      }
    }
  }
  return hits;
}

function main() {
  const args = parseArgs(process.argv);
  const mode = args.mode || "both";
  if (args.help || !args.root || !args.out) {
    process.stderr.write(
      "Usage: node marker-scan.js --root <dir> --out <findings.jsonl> [--mode deprecation|redundancy|both] [--config path] [--prefix name/]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const cfg = loadConfig(args.config);
  const excludeSet = new Set(cfg.excludeDirNames || []);
  const textExtSet = new Set(cfg.textExtensions || []);
  const maxBytes = cfg.maxFileBytes || 1_500_000;
  const rootAbs = path.resolve(args.root);
  const prefix = args.prefix || "";

  const depNeedles = mode === "redundancy" ? [] : cfg.deprecationSubstrings || [];
  const redNeedles = mode === "deprecation" ? [] : cfg.redundancySubstrings || [];

  const findings = [];
  let n = 0;

  walkFiles(rootAbs, "", excludeSet, textExtSet, maxBytes, ({ abs, rel }) => {
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      return;
    }
    if (text.includes("\u0000")) return;

    if (depNeedles.length) {
      const hits = findLines(text, depNeedles);
      for (const h of hits) {
        n++;
        findings.push({
          id: `DEP-${String(n).padStart(5, "0")}`,
          class: "deprecation-marker",
          severity: "low",
          title: `Deprecation marker: ${h.needle}`,
          path: prefix + rel,
          line: h.line,
          snippet: h.text,
          needle: h.needle,
          classification: "unclassified",
          disposition: "review",
          ts: new Date().toISOString(),
        });
      }
    }

    if (redNeedles.length) {
      const hits = findLines(text, redNeedles);
      for (const h of hits) {
        n++;
        findings.push({
          id: `RED-${String(n).padStart(5, "0")}`,
          class: "redundancy-marker",
          severity: "info",
          title: `Redundancy/lockstep marker: ${h.needle}`,
          path: prefix + rel,
          line: h.line,
          snippet: h.text,
          needle: h.needle,
          classification: "unclassified",
          disposition: "review",
          ts: new Date().toISOString(),
        });
      }
    }
  });

  writeJsonl(args.out, findings);
  process.stdout.write(
    JSON.stringify(
      {
        root: rootAbs,
        mode,
        findings: findings.length,
        deprecation: findings.filter((f) => f.class === "deprecation-marker").length,
        redundancy: findings.filter((f) => f.class === "redundancy-marker").length,
        out: path.resolve(args.out),
      },
      null,
      2,
    ) + "\n",
  );
}

main();
