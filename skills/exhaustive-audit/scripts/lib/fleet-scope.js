/**
 * Fleet inventory scope — single source for --fleet allow/skip rules.
 *
 * Product and planning trees only. Cold archive, tmp, and worktrees stay out
 * unless the operator names them via --repos or --include-archive.
 */
"use strict";

/** Default children of ~/revfleet inventoried by --fleet. */
const DEFAULT_FLEET_REPOS = [
  ".jv",
  "agency",
  "demo-offline-sync",
  "revcon",
  "revdev",
  "revealui",
  "revforge",
  "revkit",
  "revskills",
  "revvault",
  "status",
];

const FLEET_NON_PRODUCT = new Set(["archive", "tmp", "scripts", "node_modules", "wt"]);

function isWorktreeDirName(name) {
  if (name === "wt" || name === ".wt") return true;
  return name.endsWith("-wt");
}

function resolveFleetAllowlist(opts) {
  const allow =
    opts.repos && opts.repos.length > 0 ? [...opts.repos] : [...DEFAULT_FLEET_REPOS];
  if (opts.includeArchive && !allow.includes("archive")) allow.push("archive");
  return allow;
}

function shouldWalkFleetChild(name, allow) {
  if (name === "node_modules" || name === ".git") return false;
  if (name.startsWith(".") && name !== ".jv") return false;
  if (isWorktreeDirName(name) && !allow.includes(name)) return false;
  if (FLEET_NON_PRODUCT.has(name) && !allow.includes(name)) return false;
  return allow.includes(name);
}

function repoIdFromName(name) {
  return String(name)
    .replace(/^\./, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-");
}

module.exports = {
  DEFAULT_FLEET_REPOS,
  FLEET_NON_PRODUCT,
  isWorktreeDirName,
  resolveFleetAllowlist,
  shouldWalkFleetChild,
  repoIdFromName,
};
