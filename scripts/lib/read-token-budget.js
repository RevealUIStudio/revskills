/**
 * Read the control-layer token budget JSON.
 *
 * Authored in revealui packages/harnesses/src/token-budget.ts.
 * Materialize writes .revealui/adapters/grok/token-budget.json.
 * RevKit copies that file to ~/.local/share/revealui/hooks/token-budget.json.
 *
 * This module has no numeric defaults. Callers keep a last-resort fallback.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function candidatePaths() {
  const home = process.env.HOME || os.homedir();
  const explicit = process.env.REVEALUI_TOKEN_BUDGET_JSON;
  const fleet =
    process.env.REVEALFLEET_ROOT ||
    process.env.REVFLEET_ROOT ||
    path.join(home, "revealfleet");
  const paths = [
    explicit,
    path.join(home, ".local", "share", "revealui", "hooks", "token-budget.json"),
    path.join(fleet, "revealui", ".revealui", "adapters", "grok", "token-budget.json"),
  ];
  return paths.filter((p) => typeof p === "string" && p.length > 0);
}

function readTokenBudget() {
  for (const file of candidatePaths()) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!parsed || typeof parsed !== "object") continue;
      if (!Number.isFinite(parsed.compactionAtTokens) || parsed.compactionAtTokens <= 0) {
        continue;
      }
      return parsed;
    } catch {
      /* try the next path */
    }
  }
  return null;
}

module.exports = { candidatePaths, readTokenBudget };
