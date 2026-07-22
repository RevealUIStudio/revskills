#!/usr/bin/env node
/**
 * claim-shard.js — claim or release a shard under an audit run directory.
 *
 * Writes claims/<shard-id>.yml and updates shards.json status fields.
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
  if (!fs.existsSync(shardsPath)) {
    process.stderr.write(`claim-shard: missing ${shardsPath}\n`);
    process.exit(1);
  }
  const plan = JSON.parse(fs.readFileSync(shardsPath, "utf8"));
  const shard = (plan.shards || []).find((s) => s.id === args.shard);
  if (!shard) {
    process.stderr.write(`claim-shard: unknown shard ${args.shard}\n`);
    process.exit(1);
  }

  const claimsDir = path.join(run, "claims");
  fs.mkdirSync(claimsDir, { recursive: true });
  const claimFile = path.join(claimsDir, `${args.shard}.yml`);

  if (args.release) {
    if (fs.existsSync(claimFile)) fs.unlinkSync(claimFile);
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
  fs.writeFileSync(claimFile, yml);
  fs.writeFileSync(shardsPath, JSON.stringify(plan, null, 2) + "\n");
  process.stdout.write(`claimed ${args.shard} by ${args.agent} (${shard.files} files)\n`);
}

main();
