---
name: exhaustive-audit
description: >
  Multi-session exhaustive codebase audit framework. Inventory every file path with
  hashes/line counts, partition into claimable shards for concurrent or serial agents,
  read and verify every line with a machine-checked coverage ledger, cross-check
  docs/config/code, and optionally map the system via the knowledge graph (revkg / kg_*).
  Use when the user runs /exhaustive-audit, asks for a full-codebase audit, line-level
  verification, multi-agent audit, fleet-wide audit, or "account for every file/line".
license: MIT
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
  related:
    - knowledge-graph
    - multi-agent-memory
    - revealui-checkpoint
    - security-hardening
---

# Exhaustive audit framework

## Honest completeness contract

A monorepo cannot fit every line into one model context. Completeness is **machine-checked**:

1. **Inventory** — every on-disk path under scope is listed (hash, bytes, line count).
2. **Coverage ledger** — every path reaches a terminal status (`verified` | `finding` | `waived` | `blocked`).
3. **Line accountability** — for each file, the auditor records that the full content was read (or a mechanical verifier covered it), with start/end line counts matching the manifest.
4. **No silent skip** — uncovered paths at close are a **failed audit**, not a soft miss.

Knowledge graph (`revkg` / `kg_*`) **maps and relates**; it does **not** replace reading file bodies. Use KG after inventory for system views and dependency edges.

## When to use

| Trigger | Action |
|---------|--------|
| `/exhaustive-audit` or "audit every file/line" | Run full framework |
| Multi-session / multi-agent audit | Open run + shard claims |
| "Is the fleet correct?" | Fleet mode: one run root, per-repo shards |
| Single package deep dive | Scope to that path; still inventory-first |

**Not for:** tiny one-file reviews (use normal review skill); pure claim-drift (use claims validators).

## Artifacts (canonical locations)

Pick one run root (prefer an operator-private audits directory):

```text
<run-root>/
  AUDIT-RUN.yml              # run metadata + scope + status
  manifest.jsonl             # one JSON object per path (machine)
  shards.json                # partition plan
  claims/                    # per-shard claim files
  ledger/
    coverage.jsonl           # path → status + auditor + evidence
    findings.jsonl           # structured findings
  reports/
    progress.md              # human progress
    system-map.md            # optional KG-derived map
    final.md                 # closeout report
```

Default run root (writable operator dir; prefer fleet shared archive):

```bash
# Fleet shared cold store (not inside product git). See ~/revfleet/archive/README.md
export REVFLEET_ARCHIVE="${REVFLEET_ARCHIVE:-$HOME/revfleet/archive}"
export AUDIT_RUN_ROOT="${AUDIT_RUN_ROOT:-$REVFLEET_ARCHIVE/audits}"
RUN_ROOT="$AUDIT_RUN_ROOT/$(date -u +%Y-%m-%d)-<slug>"
```

## Scripts (this skill)

All under `$HOME/revfleet/revskills/skills/exhaustive-audit/scripts/`:

| Script | Purpose |
|--------|---------|
| `manifest-build.js` | Walk scope → `manifest.jsonl` (every file) |
| `shard-plan.js` | Partition manifest into non-overlapping shards |
| `coverage-status.js` | Report covered vs missing; exit 1 if incomplete |
| `claim-shard.js` | Claim/release a shard (workboard-friendly) |

```bash
SKILL="$HOME/revfleet/revskills/skills/exhaustive-audit"
node "$SKILL/scripts/manifest-build.js" --root ~/revfleet/revealui --out "$RUN_ROOT/manifest.jsonl"
node "$SKILL/scripts/shard-plan.js" --manifest "$RUN_ROOT/manifest.jsonl" --out "$RUN_ROOT/shards.json" --target-lines 8000
node "$SKILL/scripts/coverage-status.js" --manifest "$RUN_ROOT/manifest.jsonl" --ledger "$RUN_ROOT/ledger/coverage.jsonl"
```

## Multi-session protocol

### Concurrent

1. **One** session runs **open-run** (manifest + shards + `AUDIT-RUN.yml`).
2. Agents claim **disjoint** shards via `claim-shard.js` + workboard note (`workboard.d/notes/`).
3. Each session: for every path in shard → Read full file → write coverage + findings lines.
4. No two claims on same `shard_id`. Path-level re-claim only after release.
5. Closer session runs `coverage-status.js` and writes `reports/final.md`.

### Serial

Same ledger; next session resumes first `status: open` or unclaimed shard. Do not rebuild manifest unless scope HEAD changed (re-hash and re-open delta only).

### Coordination hardlines

- Multi-step product trees: worktrees from `origin/test` (not required for read-only audit of a pinned ref).
- Claims: workboard note + `claims/<shard_id>.yml`.
- Executable work discovered during audit → **file a gap/lane**; do not invent root TODO lists (`canonical-work-units`).
- Publish durable discoveries: `kg_add_episode` (agent-fact) and/or findings.jsonl.

## Session workflow (every auditor)

### 0. Open or resume

```bash
# Open (once)
mkdir -p "$RUN_ROOT"/{ledger,claims,reports}
# write AUDIT-RUN.yml from templates/AUDIT-RUN.yml
node "$SKILL/scripts/manifest-build.js" --root <SCOPE> --out "$RUN_ROOT/manifest.jsonl" \
  --exclude-defaults
node "$SKILL/scripts/shard-plan.js" --manifest "$RUN_ROOT/manifest.jsonl" \
  --out "$RUN_ROOT/shards.json" --target-lines 8000
# optional system map seed
revkg scan --repo <name>   # if POSTGRES_URL available; non-blocking
```

### 1. Claim a shard

```bash
node "$SKILL/scripts/claim-shard.js" --run "$RUN_ROOT" --shard shard-003 --agent "$AGENT_ID"
```

### 2. Exhaustive read (per path)

For each path in the shard (from `shards.json` / claim file):

1. `Read` the **entire** file (paginate with offset/limit if large; cover all lines).
2. Verify `line_count` matches manifest (or re-count and record drift as finding).
3. Classify findings (see taxonomy below).
4. Append coverage record:

```json
{
  "path": "packages/core/src/index.ts",
  "status": "verified",
  "lines_read": [1, 240],
  "manifest_lines": 240,
  "sha256": "<from manifest or recompute>",
  "agent": "grok-audit-3",
  "session": "…",
  "ts": "2026-07-22T18:00:00Z",
  "notes": ""
}
```

Statuses:

| Status | Meaning |
|--------|---------|
| `verified` | Full read; no open issue for this path |
| `finding` | Full read; one or more findings linked |
| `waived` | Full read; issues accepted with reason + owner |
| `blocked` | Cannot read (secrets binary, permission); reason required |
| `skipped-generated` | Only if path matches generated allowlist AND content spot-checked |

**Forbidden:** `skipped` without allowlist; partial reads marked verified.

### 3. Finding records

Append to `ledger/findings.jsonl`:

```json
{
  "id": "F-0012",
  "path": "…",
  "lines": [44, 48],
  "severity": "blocker|high|medium|low|info",
  "class": "bug|security|drift|dead|dup|doc-lie|todo|style|intent-dup",
  "title": "short",
  "body": "what is wrong; evidence",
  "gap": null,
  "agent": "…",
  "ts": "…"
}
```

Promotion: `blocker`/`high` → file a tracked work unit in the operator planning system (gap/lane) same or next session.

### 4. Knowledge graph (optional but preferred for system view)

After inventory (not instead of it):

```bash
revkg scan --repo revealui     # Tier-1 extractors
# or MCP: kg_context / kg_neighbors on package anchors
```

Write `reports/system-map.md`: major packages, edges, orphan-looking dirs (cross-check against manifest).

Publish audit conclusions:

```json
{ "tool": "kg_add_episode", "arguments": {
  "episodeType": "agent-fact",
  "source": "exhaustive-audit",
  "content": "…",
  "nodes": [],
  "edges": []
}}
```

### 5. Release claim + progress

```bash
node "$SKILL/scripts/claim-shard.js" --run "$RUN_ROOT" --shard shard-003 --release
node "$SKILL/scripts/coverage-status.js" --manifest "$RUN_ROOT/manifest.jsonl" \
  --ledger "$RUN_ROOT/ledger/coverage.jsonl" --write-md "$RUN_ROOT/reports/progress.md"
```

### 6. Close run

Only when `coverage-status.js` exits 0:

- `reports/final.md` — counts, finding index, gap ids filed, residual waivers
- Set `AUDIT-RUN.yml` `status: closed`
- Checkpoint / handoff fragment with run path

## Finding taxonomy (minimum)

| Class | Examples |
|-------|----------|
| `bug` | Incorrect logic, broken invariant |
| `security` | Authz, secret leak, injection |
| `drift` | Doc/code disagree (code wins; fix doc or decide) |
| `doc-lie` | Public claim false vs code |
| `dead` | Unreachable / unused export (confirm) |
| `dup` | Accidental duplication |
| `intent-dup` | Intentional dual (document, do not "fix") |
| `todo` | TODO/FIXME without gap |
| `config` | Wrong env, stale path, dual source of truth |
| `test-gap` | Critical path untested |

## Scope defaults

**Include:** source, config, CI, scripts, docs, schemas, migrations, lockfiles (as units), skill/rules markdown.

**Exclude by default** (manifest-build `--exclude-defaults`):

`node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `.turbo`, `opensrc`, binary blobs under `playwright-report`, large media, `*.map` if generated alongside dist.

**Never exclude without recording:** `.env.example`/templates, migrations, security gates, license files.

## Verification levels (depth)

| Level | Name | Bar |
|-------|------|-----|
| L1 | **Accounted** | Path in manifest |
| L2 | **Read** | Full content read; coverage row |
| L3 | **Verified** | Content checked against purpose (correctness judgment) |
| L4 | **Cross-checked** | Related tests/docs/callers consistent (use KG + grep) |

Exhaustive audit requires **L2 for every path**. L3 is the default for code/config; L4 for security, money, auth, and public claims surfaces.

## Subagent routing

| Role | Use |
|------|-----|
| Inventory + shard plan | Single session or `mechanic` |
| Shard read (many files) | `explore` read-only or full agent; one shard per agent |
| Security shards | Prefer security-aware model; mark `severity` carefully |
| Final synthesis | Senior pass over findings.jsonl only (not re-read whole tree) |

## Related skills

- `knowledge-graph` — map/relate after inventory  
- `multi-agent-memory` — session facts while audit runs  
- `security-hardening` — OWASP lens on security shards  
- `revealui-checkpoint` — close multi-session audit  
- `code-over-docs` hardline — code wins factual conflicts  

## References

- `references/methodology.md` — full phases, concurrency rules, anti-patterns  
- `templates/AUDIT-RUN.yml` — run metadata  
- `templates/coverage-line.json` — coverage record schema  
- Hardline: audit-first SDLC (studio rules)  
- Work units: tracked gaps/lanes only for remediation work  

## Anti-patterns

| Do not | Why |
|--------|-----|
| Sample 10% of files and call it exhaustive | Violates contract |
| Trust KG scan alone | No line-level content proof |
| Overlapping shard claims | Duplicate work / conflicting findings |
| Fix while auditing without tracking | Split audit vs implement PRs; file gaps |
| Write a second free-floating "audit backlog" at docs root | Use findings.jsonl + gaps |
| Mark minified vendor bundles `verified` without allowlist | Use `skipped-generated` or waive |

## MD-truth program (GAP-407)

| Script | Wave |
|--------|------|
| `scripts/w1-auto-class-md.js` | W1 historical/generated |
| `scripts/w4-jv-present-md.js` | W4 .jv residual |
| `scripts/w5-homes-md.js` | W5 claude/grok homes |
| `scripts/md-truth-check.js` | W6 gate (`--self-test` CI-safe; `--coverage` needs archive) |
| `scripts/coverage-status.js` | complete bar (exit 0) |

```bash
node skills/exhaustive-audit/scripts/md-truth-check.js --self-test
# operator:
# REVFLEET_ARCHIVE=~/revfleet/archive node …/md-truth-check.js --coverage
```
