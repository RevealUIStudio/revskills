const { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

const root = mkdtempSync(join(tmpdir(), "claim-concurrency-"));
const script = resolve(__dirname, "../skills/exhaustive-audit/scripts/claim-shard.js");
const delay = join(root, "delay.cjs");
writeFileSync(
  delay,
  "const fs=require('node:fs'); const read=fs.readFileSync; fs.readFileSync=function(p,...a){const v=read.call(this,p,...a); if(String(p).endsWith('shards.json')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100); return v;};",
);
const ids = Array.from({ length: 6 }, (_, i) => `shard-${i}`);
writeFileSync(
  join(root, "shards.json"),
  JSON.stringify({ shards: ids.map((id) => ({ id, status: "open", files: 0, lines: 0, paths: [] })) }),
);

function run(id, ...args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["--require", delay, script, "--run", root, "--shard", id, "--agent", `agent-${id}`, ...args]);
    let error = "";
    child.stderr.on("data", (data) => (error += data));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolvePromise() : reject(Error(error))));
  });
}

(async () => {
  try {
    await Promise.all(ids.map((id) => run(id)));
    let plan = JSON.parse(readFileSync(join(root, "shards.json"), "utf8"));
    assert(plan.shards.every((shard) => shard.status === "claimed"));
    await Promise.all(ids.map((id, i) => run(id, i % 2 ? "--release" : "--complete")));
    plan = JSON.parse(readFileSync(join(root, "shards.json"), "utf8"));
    assert(plan.shards.every((shard, i) => shard.status === (i % 2 ? "open" : "done")));
    assert(!existsSync(join(root, ".shards.lock")));
    console.log("PASS: concurrent claims and complete/release preserve every shard update");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
