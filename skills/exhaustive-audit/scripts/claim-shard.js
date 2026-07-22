#!/usr/bin/env node
/**
 * claim-shard.js — claim or release a shard under an audit run directory.
 *
 * Writes claims/<shard-id>.yml and updates shards.json status fields.
 * File ops are race-safe (no existsSync-then-mutate TOCTOU).
 *
 * Usage:
 *   node claim-shard.js --run <run-root> --shard shard-003 --agent grok-1
 *   node claim-shard.js --run <run-root> --shard shard-003 --release
 */
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--run") out.run = argv[++i];
    else if (a === "--shard") out.shard = argv[++i];
    else if (a === "--agent") out.agent = argv[++i];
    else if (a === "--release") out.release = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

/** Unlink if present; ignore ENOENT (no existsSync race). */
function unlinkIfPresent(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
}

/**
 * Write claim file exclusively (wx). If it already exists, refuse unless the
 * same agent is re-claiming (overwrite with r+ after verifying content).
 */
function writeClaimExclusive(filePath, body, agent) {
  try {
    const fd = fs.openSync(filePath, "wx");
    try {
      fs.writeSync(fd, body);
    } finally {
      fs.closeSync(fd);
    }
    return;
  } catch (err) {
    if (!err || err.code !== "EEXIST") throw err;
  }
  // Existing claim: allow same-agent refresh only.
  let existing = "";
  try {
    existing = fs.readFileSync(filePath, "utf8");
  } catch (readErr) {
    if (readErr && readErr.code === "ENOENT") {
      // Lost race with release; retry exclusive create once.
      const fd = fs.openSync(filePath, "wx");
      try {
        fs.writeSync(fd, body);
      } finally {
        fs.closeSync(fd);
      }
      return;
    }
    throw readErr;
  }
  if (!existing.includes(`agent: ${agent}`)) {
    const err = new Error(`claim file already held by another agent: ${filePath}`);
    err.code = "EEXIST";
    throw err;
  }
  fs.writeFileSync(filePath, body);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.run || !args.shard) {
    process.stderr.write(
      "Usage: node claim-shard.js --run <run-root> --shard <id> (--agent <id> | --release)\n",
    );
    process.exit(args.help ? 0 : 1);
  }
  if (!args.release && !args.agent) {
    process.stderr.write("claim-shard: --agent required unless --release\n");
    process.exit(1);
  }

  const run = path.resolve(args.run);
  const shardsPath = path.join(run, "shards.json");
  let planRaw;
  try {
    planRaw = fs.readFileSync(shardsPath, "utf8");
  } catch (err) {
    process.stderr.write(`claim-shard: missing ${shardsPath}\n`);
    process.exit(1);
  }
  const plan = JSON.parse(planRaw);
  const shard = (plan.shards || []).find((s) => s.id === args.shard);
  if (!shard) {
    process.stderr.write(`claim-shard: unknown shard ${args.shard}\n`);
    process.exit(1);
  }

  const claimsDir = path.join(run, "claims");
  fs.mkdirSync(claimsDir, { recursive: true });
  const claimFile = path.join(claimsDir, `${args.shard}.yml`);

  if (args.release) {
    unlinkIfPresent(claimFile);
    shard.status = "open";
    delete shard.claimedBy;
    delete shard.claimedAt;
    fs.writeFileSync(shardsPath, JSON.stringify(plan, null, 2) + "\n");
    process.stdout.write(`released ${args.shard}\n`);
    return;
  }

  if (shard.status === "claimed" && shard.claimedBy && shard.claimedBy !== args.agent) {
    process.stderr.write(
      `claim-shard: ${args.shard} already claimed by ${shard.claimedBy}\n`,
    );
    process.exit(2);
  }

  const now = new Date().toISOString();
  shard.status = "claimed";
  shard.claimedBy = args.agent;
  shard.claimedAt = now;

  const yml = [
    `shard: ${args.shard}`,
    `agent: ${args.agent}`,
    `claimed_at: ${now}`,
    `files: ${shard.files}`,
    `lines: ${shard.lines}`,
    `paths:`,
    ...shard.paths.map((p) => `  - ${JSON.stringify(p)}`),
    "",
  ].join("\n");

  try {
    writeClaimExclusive(claimFile, yml, args.agent);
  } catch (err) {
    if (err && err.code === "EEXIST") {
      process.stderr.write(`claim-shard: ${args.shard} claim file held by another agent\n`);
      process.exit(2);
    }
    throw err;
  }

  fs.writeFileSync(shardsPath, JSON.stringify(plan, null, 2) + "\n");
  process.stdout.write(`claimed ${args.shard} by ${args.agent} (${shard.files} files)\n`);
}

main();
