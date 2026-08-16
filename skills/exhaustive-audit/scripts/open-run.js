#!/usr/bin/env node
/**
 * open-run.js — create an audit run directory. Does not claim a shard.
 *
 * Writes AUDIT-RUN.yml (git pins), builds manifest + shards, creates
 * ledger/claims/reports. Completeness still requires coverage-status exit 0
 * after shard work.
 *
 * Usage:
 *   node open-run.js --root ~/revfleet --fleet --slug fleet-p0
 *   node open-run.js --root ~/revfleet/revealui --slug revealui
 *   node open-run.js --root ~/revfleet --fleet --out /tmp/audit-run --mode code
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { DEFAULT_FLEET_REPOS } = require("./lib/fleet-scope");

const HERE = path.dirname(__filename);

function parseArgs(argv) {
  const out = { fleet: false, includeArchive: false, mode: "code", repos: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") out.root = argv[++i];
    else if (a === "--slug") out.slug = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--fleet") out.fleet = true;
    else if (a === "--include-archive") out.includeArchive = true;
    else if (a === "--mode") out.mode = argv[++i];
    else if (a === "--repos") {
      out.repos = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function defaultRunRoot(slug) {
  const archive =
    process.env.AUDIT_RUN_ROOT ||
    path.join(
      process.env.REVFLEET_ARCHIVE || path.join(process.env.HOME || "", "revfleet/archive/cold"),
      "audits",
    );
  const day = new Date().toISOString().slice(0, 10);
  return path.join(archive, `${day}-${slug}`);
}

function gitPin(repoAbs) {
  const head = spawnSync("git", ["-C", repoAbs, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (head.status !== 0) return { head: null, branch: null };
  const branch = spawnSync("git", ["-C", repoAbs, "rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
  });
  return {
    head: (head.stdout || "").trim() || null,
    branch: (branch.stdout || "").trim() || null,
  };
}

function yamlQuote(s) {
  if (s === null || s === undefined) return "null";
  return JSON.stringify(String(s));
}

function writeAuditRunYml(file, meta) {
  const pinLines = meta.pins
    .map((p) => {
      return [
        `    - repo: ${yamlQuote(p.repo)}`,
        `      head: ${yamlQuote(p.head)}`,
        `      branch: ${yamlQuote(p.branch)}`,
      ].join("\n");
    })
    .join("\n");
  const roots = meta.roots.map((r) => `    - ${yamlQuote(r)}`).join("\n");
  const body = [
    `id: ${yamlQuote(meta.id)}`,
    `status: open`,
    `opened: ${yamlQuote(meta.opened)}`,
    `closed: null`,
    `opened_by: ${yamlQuote(meta.openedBy)}`,
    `mode: ${yamlQuote(meta.mode)}`,
    ``,
    `scope:`,
    `  fleet: ${meta.fleet}`,
    `  include_archive: ${meta.includeArchive}`,
    `  roots:`,
    roots,
    `  pins:`,
    pinLines || `    []`,
    `  exclude_defaults: true`,
    ``,
    `depth:`,
    `  minimum: L2`,
    `  default_code: L3`,
    `  phase0_assessment: true`,
    ``,
    `coordination:`,
    `  mode: serial`,
    `  claim_unit: shard`,
    ``,
    `artifacts:`,
    `  manifest: manifest.jsonl`,
    `  shards: shards.json`,
    `  coverage: ledger/coverage.jsonl`,
    `  findings: ledger/findings.jsonl`,
    `  progress: reports/progress.md`,
    `  assessment: reports/assessment.md`,
    `  final: reports/final.md`,
    ``,
    `notes: |`,
    `  Opened by open-run.js. Completeness = coverage-status.js --mode ${meta.mode} exit 0.`,
    `  Phase 0 product assessment lives in reports/assessment.md and is not line coverage.`,
    ``,
  ].join("\n");
  fs.writeFileSync(file, body);
}

function runNode(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    process.stderr.write(`open-run: ${path.basename(script)} failed (${r.status})\n`);
    process.exit(r.status || 1);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.root || !args.slug) {
    process.stderr.write(
      "Usage: node open-run.js --root <dir> --slug <slug> [--out <run-root>] [--fleet] [--include-archive] [--repos a,b] [--mode code|md-truth]\n",
    );
    process.exit(args.help ? 0 : 1);
  }
  if (args.mode !== "code" && args.mode !== "md-truth") {
    process.stderr.write(`open-run: unknown --mode ${args.mode}\n`);
    process.exit(1);
  }

  const rootAbs = path.resolve(args.root);
  if (!fs.existsSync(rootAbs) || !fs.statSync(rootAbs).isDirectory()) {
    process.stderr.write(`open-run: not a directory: ${rootAbs}\n`);
    process.exit(1);
  }

  const runRoot = path.resolve(args.out || defaultRunRoot(args.slug));
  if (fs.existsSync(path.join(runRoot, "AUDIT-RUN.yml"))) {
    process.stderr.write(`open-run: already exists ${runRoot}/AUDIT-RUN.yml\n`);
    process.exit(2);
  }

  fs.mkdirSync(path.join(runRoot, "ledger"), { recursive: true });
  fs.mkdirSync(path.join(runRoot, "claims"), { recursive: true });
  fs.mkdirSync(path.join(runRoot, "reports"), { recursive: true });

  const pinRepos = args.fleet
    ? args.repos.length
      ? args.repos
      : args.includeArchive
        ? [...DEFAULT_FLEET_REPOS, "archive"]
        : [...DEFAULT_FLEET_REPOS]
    : [path.basename(rootAbs)];

  const pins = [];
  const roots = [];
  if (args.fleet) {
    for (const name of pinRepos) {
      const abs = path.join(rootAbs, name);
      if (!fs.existsSync(abs)) continue;
      roots.push(abs);
      const pin = gitPin(abs);
      pins.push({ repo: name, ...pin });
    }
  } else {
    roots.push(rootAbs);
    pins.push({ repo: path.basename(rootAbs), ...gitPin(rootAbs) });
  }

  const opened = new Date().toISOString();
  const id = `audit-${opened.slice(0, 10)}-${args.slug}`;
  writeAuditRunYml(path.join(runRoot, "AUDIT-RUN.yml"), {
    id,
    opened,
    openedBy: process.env.USER || "agent",
    mode: args.mode,
    fleet: Boolean(args.fleet),
    includeArchive: Boolean(args.includeArchive),
    roots,
    pins,
  });

  const manifestArgs = [
    "--root",
    rootAbs,
    "--out",
    path.join(runRoot, "manifest.jsonl"),
    "--exclude-defaults",
  ];
  if (args.fleet) manifestArgs.push("--fleet");
  if (args.includeArchive) manifestArgs.push("--include-archive");
  if (args.repos.length) manifestArgs.push("--repos", args.repos.join(","));

  runNode(path.join(HERE, "manifest-build.js"), manifestArgs);

  const shardArgs = [
    "--manifest",
    path.join(runRoot, "manifest.jsonl"),
    "--out",
    path.join(runRoot, "shards.json"),
    "--target-lines",
    "8000",
  ];
  if (args.fleet) shardArgs.push("--by-repo");
  runNode(path.join(HERE, "shard-plan.js"), shardArgs);

  process.stdout.write(
    JSON.stringify(
      {
        run: runRoot,
        id,
        mode: args.mode,
        fleet: Boolean(args.fleet),
        pins: pins.length,
      },
      null,
      2,
    ) + "\n",
  );
}

main();
