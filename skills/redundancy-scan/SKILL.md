---
name: redundancy-scan
description: >
  Fleet workflow for finding duplication, deprecation, and redundancy (exact file
  clones, deprecation markers, lockstep/mirror comments, basename collisions).
  Multi-session friendly with machine findings + human classification
  (intentional vs accidental). Use when /redundancy-scan, /dedupe, fleet redundancy
  audit, find duplicates, dead dual implementations, deprecated code still shipping,
  or extend-before-create consolidation passes.
license: MIT
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
  related:
    - exhaustive-audit
    - knowledge-graph
    - extend-before-create
---

# Redundancy / deprecation / duplication scan

## Purpose

Find **accidental** duplication and stale dual paths across a repo or the whole fleet, without deleting **intentional** duals (decoupling, test isolation, public facades).

Complements:

| Skill / lane | Relationship |
|--------------|--------------|
| `exhaustive-audit` | Line-level completeness of a tree |
| `fleet-redundancy` lane + remediation spec | Program backlog for consolidation PRs |
| `extend-before-create` hardline | Why we scan before building net-new |
| `knowledge-graph` | Optional: after findings, map “who imports both” |

## Detection classes (this skill)

| Class | Detector | What it means |
|-------|----------|----------------|
| `exact-duplicate` | `hash-dups.js` | Same sha256 body, ≥2 paths |
| `deprecation-marker` | `marker-scan.js` | `@deprecated`, SUPERSEDED, DO NOT USE, TODO remove… |
| `redundancy-marker` | `marker-scan.js` | “keep in lockstep”, “mirrors”, “byte-identical”… |
| `basename-collision` | `name-collision.js` | Same filename in many dirs (heuristic) |

**Not automated here (session follow-ups):** unused exports (knip), clone *near*-matches (jscpd), dual SECURITY_PATHS (GAP-404), package catalog drift (syncpack). Run those tools when the mechanical pass is done; record results into the same run directory.

## Config

Default knobs: `config/defaults.json` (exclude dirs, marker lists, size limits).

Override:

```bash
node scripts/run-scan.js --root … --out-dir … --config /path/to/override.json
```

Do not put private planning-repo paths in config committed to this package.

## Artifacts

Prefer the fleet shared archive (not product git):

```bash
export REVFLEET_ARCHIVE="${REVFLEET_ARCHIVE:-$HOME/revfleet/archive}"
OUT="$REVFLEET_ARCHIVE/audits/$(date -u +%Y-%m-%d)-redundancy-<scope>"
```

```text
$OUT/
  RUN.json
  raw/*.jsonl          # per-detector outputs
  findings.jsonl       # merged
  report.md            # human summary
  summary.json
  classified/          # optional: agent-edited classifications
```

## Quick start (one repo)

```bash
SKILL="$HOME/revfleet/revskills/skills/redundancy-scan"
export REVFLEET_ARCHIVE="${REVFLEET_ARCHIVE:-$HOME/revfleet/archive}"
OUT="$REVFLEET_ARCHIVE/audits/$(date -u +%Y-%m-%d)-redundancy-revealui"
mkdir -p "$OUT"

node "$SKILL/scripts/run-scan.js" \
  --root "$HOME/revfleet/revealui" \
  --out-dir "$OUT"

# read $OUT/report.md then classify findings
```

## Fleet mode

```bash
node "$SKILL/scripts/run-scan.js" \
  --root "$HOME/revfleet" \
  --fleet \
  --out-dir "$REVFLEET_ARCHIVE/audits/$(date -u +%Y-%m-%d)-redundancy-fleet"
```

Skips hidden directories, `archive/`, and worktree-style sibling folders.

## Workflow (multi-session)

### Session A — detect (mechanical)

1. Run `run-scan.js` for scope.
2. Workboard note: `redundancy-scan:<date>-<scope>`.
3. Do **not** delete code yet.

### Session B — classify (judgment)

For each high-signal finding (start with `exact-duplicate` and deprecation markers on runtime paths):

| Classification | Action |
|----------------|--------|
| **intentional** | Record reason (decoupling, test isolation, facade). Leave code. |
| **accidental + small** | One PR consolidate / delete (extend-before-create). |
| **accidental + large** | File a gap or fleet-redundancy lane item; link finding ids. |
| **deprecation without owner** | Either remove, or gap with removal plan + deadline. |

Append classifications to `classified/decisions.jsonl`:

```json
{
  "id": "DUP-EXACT-0001",
  "classification": "accidental",
  "action": "gap|pr|leave",
  "gap": null,
  "notes": "two copies of PEM unescape; keep packages/security",
  "agent": "…",
  "ts": "…"
}
```

### Session C — remediate

1. Implement only **classified accidental** items (or owner-authorized).
2. Prefer consolidate onto `@revealui/*` native parts.
3. Public PRs: no private planning paths in bodies.
4. Re-run scan on touched packages; delta should shrink.

### Optional tools (document in RUN.json)

```bash
# near-dupe clones (if available)
pnpm dlx jscpd <root> --ignore "**/node_modules/**,**/dist/**"

# unused (if configured in monorepo)
pnpm exec knip   # only when package supports it

# catalog drift
pnpm exec syncpack lint
```

Paste summary counts into `$OUT/optional-tools.md`.

## Severity guide

| Signal | Suggested severity |
|--------|-------------------|
| Exact dup in `packages/` runtime | medium → high if security/billing |
| Exact dup only in tests/fixtures | low / often intentional |
| Deprecation marker in hot path still imported | high |
| Deprecation marker in docs only | info |
| Basename collision for unique domain files | medium (investigate) |
| Basename collision for common names | ignore / allowlist |

## Multi-agent concurrency

- **Detect** phase is single-writer on `$OUT` (one agent runs `run-scan.js`).
- **Classify** can shard by finding id ranges or by class (`exact-duplicate` vs `deprecation-marker`).
- **Remediate** uses normal worktrees from `origin/test`; one PR cluster per theme (logger, ValidationError, PEM unescape…).

## Anti-patterns

| Do not | Why |
|--------|-----|
| Delete every exact dup without classification | Breaks intentional duals |
| Treat jscpd % as a gate without filtering drafts/untracked | Inflated (blog-drafts history) |
| Open a second “redundancy backlog” at docs root | Use findings.jsonl + gaps/lanes |
| Re-author extend-before-create policy in Grok | Pointer to claude-config hardline only |

## Related references

- `references/methodology.md` — full taxonomy and intentional-dup examples  
- `config/defaults.json` — markers and excludes  
- Fleet lane: operator planning `fleet-redundancy` + remediation spec (when authorized)  
- Hardlines: extend-before-create, audit-first mindfulness, code-over-docs  

## Scripts

| Script | Role |
|--------|------|
| `run-scan.js` | Orchestrate all detectors + merge report |
| `hash-dups.js` | Exact content clones |
| `marker-scan.js` | Deprecation + redundancy phrase hits |
| `name-collision.js` | Basename multipaths |
| `merge-report.js` | Combine JSONL → report.md |
