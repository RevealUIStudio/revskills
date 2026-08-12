#!/usr/bin/env node
/**
 * run-scan.js — one-shot: hash dups + markers + name collisions → report.
 *
 * Usage:
 *   node run-scan.js --root ~/revfleet/revealui --out-dir ~/revfleet/archive/cold/audits/2026-07-22-redundancy-revealui
 *   node run-scan.js --root ~/revfleet --fleet --out-dir $REVFLEET_ARCHIVE/audits/redundancy-fleet
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseArgs } = require("./lib.js");

function run(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    process.stderr.write(`run-scan: ${path.basename(script)} failed (${r.status})\n`);
    process.exit(r.status || 1);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.root || !args["out-dir"]) {
    process.stderr.write(
      "Usage: node run-scan.js --root <dir> --out-dir <dir> [--fleet] [--config path] [--prefix name/]\n",
    );
    process.exit(args.help ? 0 : 1);
  }

  const scriptsDir = __dirname;
  const outDir = path.resolve(args["out-dir"]);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });

  const root = path.resolve(args.root);
  const configArgs = args.config ? ["--config", args.config] : [];

  const meta = {
    root,
    fleet: Boolean(args.fleet),
    started: new Date().toISOString(),
    outDir,
    prefix: args.prefix || "",
  };
  fs.writeFileSync(path.join(outDir, "RUN.json"), JSON.stringify(meta, null, 2) + "\n");

  if (args.fleet) {
    // scan each immediate child directory
    const kids = fs.readdirSync(root, { withFileTypes: true });
    const inputs = [];
    for (const ent of kids) {
      if (!ent.isDirectory()) continue;
      // Skip hidden dirs and known non-product trees (worktrees, local archive).
      if (ent.name.startsWith(".")) continue;
      if (["archive", "node_modules", "wt", "node_modules"].includes(ent.name)) continue;
      if (ent.name.endsWith("-wt") || ent.name === "wt") continue;
      const child = path.join(root, ent.name);
      const pref = `${ent.name}/`;
      const h = path.join(outDir, "raw", `${ent.name}-hash.jsonl`);
      const m = path.join(outDir, "raw", `${ent.name}-markers.jsonl`);
      const n = path.join(outDir, "raw", `${ent.name}-names.jsonl`);
      run(path.join(scriptsDir, "hash-dups.js"), [
        "--root",
        child,
        "--out",
        h,
        "--prefix",
        pref,
        ...configArgs,
      ]);
      run(path.join(scriptsDir, "marker-scan.js"), [
        "--root",
        child,
        "--out",
        m,
        "--mode",
        "both",
        "--prefix",
        pref,
        ...configArgs,
      ]);
      run(path.join(scriptsDir, "name-collision.js"), [
        "--root",
        child,
        "--out",
        n,
        "--prefix",
        pref,
        ...configArgs,
      ]);
      inputs.push(h, m, n);
    }
    run(path.join(scriptsDir, "merge-report.js"), [
      "--out-dir",
      outDir,
      "--inputs",
      inputs.join(","),
    ]);
  } else {
    const h = path.join(outDir, "raw", "hash.jsonl");
    const m = path.join(outDir, "raw", "markers.jsonl");
    const n = path.join(outDir, "raw", "names.jsonl");
    const prefArgs = args.prefix ? ["--prefix", args.prefix] : [];
    run(path.join(scriptsDir, "hash-dups.js"), [
      "--root",
      root,
      "--out",
      h,
      ...prefArgs,
      ...configArgs,
    ]);
    run(path.join(scriptsDir, "marker-scan.js"), [
      "--root",
      root,
      "--out",
      m,
      "--mode",
      "both",
      ...prefArgs,
      ...configArgs,
    ]);
    run(path.join(scriptsDir, "name-collision.js"), [
      "--root",
      root,
      "--out",
      n,
      ...prefArgs,
      ...configArgs,
    ]);
    run(path.join(scriptsDir, "merge-report.js"), [
      "--out-dir",
      outDir,
      "--inputs",
      [h, m, n].join(","),
    ]);
  }

  meta.finished = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "RUN.json"), JSON.stringify(meta, null, 2) + "\n");
  process.stdout.write(`run-scan complete → ${outDir}\n`);
}

main();
