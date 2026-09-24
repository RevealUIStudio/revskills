#!/usr/bin/env node
/**
 * Cap grep and shell output before it is stored in the model transcript.
 *
 * PostToolUse is not a block. The replacement is the model's copy only.
 * read_file is left intact. A result grok already truncated to a plain
 * string cannot be echoed back, so this hook leaves that one alone.
 *
 * Live install (Grok reads the hook JSON, not this repo path):
 *   ~/.local/share/revealui/hooks/cap-tool-output.js
 *   ~/.grok/hooks/cap-tool-output.json
 *
 * Env (tests): REVEALUI_TOOL_OUTPUT_CAP, REVEALUI_TOOL_OUTPUT_HEAD,
 * REVEALUI_TOOL_OUTPUT_TAIL. Defaults 30720 / 12288 / 12288 characters.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function loadBudget() {
  const candidates = [
    path.join(__dirname, "lib", "read-token-budget.js"),
    path.join(__dirname, "read-token-budget.js"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const reader = require(file);
      return reader.readTokenBudget();
    } catch {
      /* next candidate */
    }
  }
  return null;
}

const BUDGET = loadBudget();
const CAP = positiveInt(
  process.env.REVEALUI_TOOL_OUTPUT_CAP,
  (BUDGET && BUDGET.toolOutputCapChars) || 30 * 1024,
);
const HEAD = positiveInt(
  process.env.REVEALUI_TOOL_OUTPUT_HEAD,
  (BUDGET && BUDGET.toolOutputHeadChars) || 12 * 1024,
);
const TAIL = positiveInt(
  process.env.REVEALUI_TOOL_OUTPUT_TAIL,
  (BUDGET && BUDGET.toolOutputTailChars) || 12 * 1024,
);
const CAPPED_TOOLS = new Set(
  Array.isArray(BUDGET && BUDGET.cappedTools) && BUDGET.cappedTools.length > 0
    ? BUDGET.cappedTools
    : ["grep", "run_terminal_command"],
);
const OUTPUT_KEY = /^(output|stdout|stderr|content|text|result|body|output_for_prompt|outputForPrompt)$/i;

function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function readStdin() {
  try {
    const stat = fs.fstatSync(0);
    if (!stat.isFIFO() && !stat.isSocket() && !stat.isFile()) return {};
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toolName(payload) {
  const name = payload.toolName || payload.tool_name || "";
  return typeof name === "string" ? name : "";
}

function toolResult(payload) {
  if (payload.toolResult && typeof payload.toolResult === "object") return payload.toolResult;
  if (payload.tool_response && typeof payload.tool_response === "object") return payload.tool_response;
  return null;
}

function alreadyTruncated(payload) {
  return payload.toolResultTruncated === true || payload.tool_result_truncated === true;
}

function clip(text) {
  if (typeof text !== "string" || text.length <= CAP) return text;
  const head = text.slice(0, Math.min(HEAD, text.length));
  const tail = text.slice(Math.max(head.length, text.length - TAIL));
  const omitted = text.length - head.length - tail.length;
  return (
    head +
    `\n\n[cap-tool-output: omitted ${omitted} characters from the middle. ` +
    `Re-run a narrower command if you need that span.]\n\n` +
    tail
  );
}

function clipTree(value, depth) {
  if (depth > 6 || !value || typeof value !== "object") return false;
  let changed = false;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (clipTree(item, depth + 1)) changed = true;
    }
    return changed;
  }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && OUTPUT_KEY.test(key) && child.length > CAP) {
      value[key] = clip(child);
      changed = true;
    } else if (child && typeof child === "object") {
      if (clipTree(child, depth + 1)) changed = true;
    }
  }
  return changed;
}

function main() {
  const payload = readStdin();
  if (!CAPPED_TOOLS.has(toolName(payload))) return;
  if (alreadyTruncated(payload)) return;
  const result = toolResult(payload);
  if (!result) return;
  const copy = JSON.parse(JSON.stringify(result));
  if (!clipTree(copy, 0)) return;
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedToolOutput: copy,
      },
    })}\n`,
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(
    `[cap-tool-output] fail-open: ${err && err.message ? err.message : err}\n`,
  );
}
