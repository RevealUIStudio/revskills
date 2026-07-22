"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function loadConfig(configPath) {
  const defaultsPath = path.join(__dirname, "..", "config", "defaults.json");
  const base = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));
  if (!configPath) return base;
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`config not found: ${abs}`);
  }
  const over = JSON.parse(fs.readFileSync(abs, "utf8"));
  return {
    ...base,
    ...over,
    excludeDirNames: over.excludeDirNames || base.excludeDirNames,
    textExtensions: over.textExtensions || base.textExtensions,
    deprecationSubstrings: over.deprecationSubstrings || base.deprecationSubstrings,
    redundancySubstrings: over.redundancySubstrings || base.redundancySubstrings,
  };
}

function shouldSkipDir(name, excludeSet) {
  return excludeSet.has(name);
}

function walkFiles(rootAbs, relBase, excludeSet, textExtSet, maxFileBytes, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(rootAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (ent.isDirectory()) {
      if (shouldSkipDir(name, excludeSet)) continue;
      walkFiles(
        path.join(rootAbs, name),
        path.join(relBase, name),
        excludeSet,
        textExtSet,
        maxFileBytes,
        onFile,
      );
      continue;
    }
    if (!ent.isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if (textExtSet.size && !textExtSet.has(ext) && name !== "Dockerfile") continue;
    const abs = path.join(rootAbs, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (st.size > maxFileBytes) continue;
    const rel = path.join(relBase, name).split(path.sep).join("/");
    onFile({ abs, rel, size: st.size, ext });
  }
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function writeJsonl(filePath, rows) {
  ensureDirFor(filePath);
  const fd = fs.openSync(filePath, "w");
  for (const r of rows) {
    fs.writeSync(fd, JSON.stringify(r) + "\n");
  }
  fs.closeSync(fd);
}

function appendJsonl(filePath, row) {
  ensureDirFor(filePath);
  fs.appendFileSync(filePath, JSON.stringify(row) + "\n");
}

module.exports = {
  parseArgs,
  loadConfig,
  walkFiles,
  writeJsonl,
  appendJsonl,
  ensureDirFor,
};
