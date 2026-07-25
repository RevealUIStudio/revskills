#!/usr/bin/env node
/**
 * md-truth-check.js — GAP-407 W6: machine gate for MD-truth program health.
 *
 * Modes:
 *   --self-test     Verify W1/W4/W5 scripts exist + coverage-status accepts C3
 *                   statuses. Always safe for CI (no archive required).
 *   --coverage      Require REVFLEET_ARCHIVE/audits/<run> (or --run) and fail
 *                   unless coverage-status exits 0 on fleet+homes manifests.
 *
 * Usage:
 *   node md-truth-check.js --self-test
 *   node md-truth-check.js --coverage [--run 2026-07-22-md-truth]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const HERE = path.dirname(__filename);

function parseArgs(argv) {
  const out = { selfTest: false, coverage: false, run: "2026-07-22-md-truth" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") out.selfTest = true;
    else if (a === "--coverage") out.coverage = true;
    else if (a === "--run") out.run = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function mustExist(rel) {
  const p = path.join(HERE, rel);
  if (!fs.existsSync(p)) throw new Error(`missing required script: ${rel}`);
  return p;
}

function selfTest() {
  const required = [
    "coverage-status.js",
    "w1-auto-class-md.js",
    "w4-jv-present-md.js",
    "w5-homes-md.js",
    "md-truth-check.js",
  ];
  for (const r of required) mustExist(r);

  // coverage-status must accept historical-ok (W1 C3)
  const src = fs.readFileSync(path.join(HERE, "coverage-status.js"), "utf8");
  if (!src.includes("historical-ok") || !src.includes("generated-ok")) {
    throw new Error("coverage-status.js missing C3 terminal statuses historical-ok/generated-ok");
  }

  // classifier smoke: dry-run path rules without archive
  const w1 = fs.readFileSync(path.join(HERE, "w1-auto-class-md.js"), "utf8");
  if (!w1.includes("classifyByPath") || !w1.includes("historical-ok")) {
    throw new Error("w1-auto-class-md.js missing classifier");
  }
  const w4 = fs.readFileSync(path.join(HERE, "w4-jv-present-md.js"), "utf8");
  if (!w4.includes("classifyJv")) throw new Error("w4 missing classifyJv");
  const w5 = fs.readFileSync(path.join(HERE, "w5-homes-md.js"), "utf8");
  if (!w5.includes("classifyHome")) throw new Error("w5 missing classifyHome");

  process.stdout.write("md-truth-check --self-test: OK\n");
}

function coverageCheck(runId) {
  const archive = process.env.REVFLEET_ARCHIVE || path.join(process.env.HOME || "", "revfleet/archive");
  const runDir = path.join(archive, "audits", runId);
  if (!fs.existsSync(runDir)) {
    throw new Error(
      `coverage run not found: ${runDir} (set REVFLEET_ARCHIVE or skip --coverage in CI without archive)`,
    );
  }
  const main = path.join(runDir, "manifest.jsonl");
  const claude = path.join(runDir, "manifest-claude-home-md.jsonl");
  const grok = path.join(runDir, "manifest-grok-home-md.jsonl");
  const ledger = path.join(runDir, "ledger", "coverage.jsonl");
  for (const f of [main, ledger]) {
    if (!fs.existsSync(f)) throw new Error(`missing ${f}`);
  }

  const combined = path.join(runDir, "manifest-fleet-plus-homes.jsonl");
  const parts = [fs.readFileSync(main, "utf8").trim()];
  if (fs.existsSync(claude)) parts.push(fs.readFileSync(claude, "utf8").trim());
  if (fs.existsSync(grok)) parts.push(fs.readFileSync(grok, "utf8").trim());
  fs.writeFileSync(combined, parts.filter(Boolean).join("\n") + "\n");

  const r = spawnSync(
    process.execPath,
    [path.join(HERE, "coverage-status.js"), "--manifest", combined, "--ledger", ledger],
    { encoding: "utf8" },
  );
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) {
    throw new Error("coverage-status failed (incomplete MD truth ledger)");
  }
  process.stdout.write("md-truth-check --coverage: OK\n");
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.selfTest && !args.coverage)) {
    process.stderr.write(
      "Usage: node md-truth-check.js --self-test | --coverage [--run 2026-07-22-md-truth]\n",
    );
    process.exit(args.help ? 0 : 1);
  }
  try {
    if (args.selfTest) selfTest();
    if (args.coverage) coverageCheck(args.run);
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e) + "\n");
    process.exit(1);
  }
}

main();
