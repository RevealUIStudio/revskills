#!/usr/bin/env node
/**
 * Write the control-layer token budget into ~/.grok/config.toml.
 *
 * Usage: node sync-grok-token-budget.js <token-budget.json> <config.toml>
 *
 * Updates auto_compact_threshold_percent and compaction_at_tokens for each
 * model id in the budget. Leaves every other line in place. Creates a
 * minimal file when config.toml is missing.
 *
 * Percent is always compactionAtTokens / contextWindowTokens, rounded.
 * A percent field in the JSON that disagrees is ignored.
 */
"use strict";

const fs = require("fs");

function fail(message) {
  process.stderr.write(`sync-grok-token-budget: ${message}\n`);
  process.exit(1);
}

function loadBudget(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    fail(`cannot read ${file}: ${err && err.message ? err.message : err}`);
  }
  const tokens = Number(parsed.compactionAtTokens);
  const windowTokens = Number(parsed.contextWindowTokens);
  const models = Array.isArray(parsed.models) ? parsed.models.filter((m) => typeof m === "string" && m) : [];
  if (!Number.isFinite(tokens) || tokens <= 0) fail("compactionAtTokens missing");
  if (!Number.isFinite(windowTokens) || windowTokens <= 0) fail("contextWindowTokens missing");
  if (models.length === 0) fail("models missing");
  return {
    tokens,
    percent: Math.round((tokens / windowTokens) * 100),
    models,
  };
}

function upsertPercent(text, percent) {
  const re = /auto_compact_threshold_percent\s*=\s*\d+/;
  if (re.test(text)) return text.replace(re, `auto_compact_threshold_percent = ${percent}`);
  if (/^\[session\]\s*$/m.test(text)) {
    return text.replace(/^\[session\]\s*$/m, `[session]\nauto_compact_threshold_percent = ${percent}`);
  }
  return `${text.replace(/\s*$/, "")}\n\n[session]\nauto_compact_threshold_percent = ${percent}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertModel(text, modelId, tokens) {
  const header = `[model."${modelId}"]`;
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === header) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    const body = text.replace(/\s*$/, "");
    return `${body}\n\n${header}\ncompaction_at_tokens = ${tokens}\n`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("[")) {
      end = i;
      break;
    }
  }
  let found = false;
  for (let i = start + 1; i < end; i += 1) {
    if (/^\s*compaction_at_tokens\s*=/.test(lines[i])) {
      lines[i] = `compaction_at_tokens = ${tokens}`;
      found = true;
      break;
    }
  }
  if (!found) lines.splice(end, 0, `compaction_at_tokens = ${tokens}`);
  return lines.join("\n");
}

function applyBudget(text, budget) {
  let next = upsertPercent(text, budget.percent);
  for (const modelId of budget.models) {
    if (!/^[\w.-]+$/.test(modelId)) fail(`refusing model id ${modelId}`);
    next = upsertModel(next, modelId, budget.tokens);
  }
  if (!next.endsWith("\n")) next += "\n";
  return next;
}

function main() {
  const budgetFile = process.argv[2];
  const configFile = process.argv[3];
  if (!budgetFile || !configFile) {
    fail("usage: sync-grok-token-budget.js <token-budget.json> <config.toml>");
  }
  const budget = loadBudget(budgetFile);
  const existing = fs.existsSync(configFile) ? fs.readFileSync(configFile, "utf8") : "";
  const next = applyBudget(existing, budget);
  fs.mkdirSync(require("path").dirname(configFile), { recursive: true });
  if (next !== (existing.endsWith("\n") || existing === "" ? existing : `${existing}\n`)) {
    fs.writeFileSync(configFile, next);
  } else if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, next);
  }
  process.stdout.write(
    `sync-grok-token-budget: compaction_at_tokens=${budget.tokens} percent=${budget.percent} models=${budget.models.join(",")}\n`,
  );
}

if (require.main === module) main();

module.exports = { applyBudget, loadBudget, escapeRegExp };
