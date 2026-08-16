# Exhaustive audit methodology

Companion to `../SKILL.md`. This is the long form for multi-session fleets.

## Why inventory-first

Agents cannot hold a monorepo in context. **Accounting** is:

| Layer | Proof |
|-------|--------|
| Path set | `manifest.jsonl` lists every file after excludes |
| Content read | `coverage.jsonl` has terminal status + `lines_read` spanning file |
| Correctness | Human/agent judgment → `verified` or `finding` |
| System shape | Optional `revkg scan` / `kg_*` map — secondary |

If inventory and coverage disagree, the audit is incomplete. Full stop.

## Phases

### Phase 0 — Product assessment (optional, fleet honesty)

Before or beside line reads: one `reports/assessment.md` using `templates/assessment.md`. Verdicts are per repo (`shippable-core` / `sold-ahead-of-runtime` / `infra-only` / `archive-grade` / `leftover`). This is not coverage. Do not call the run exhaustive after Phase 0 alone.

### Phase A — Open run (once)

1. Define scope: one repo or `open-run.js --fleet` (allowlist in `scripts/lib/fleet-scope.js`; `archive/` is opt-in).
2. `open-run.js` pins each repo HEAD, writes `AUDIT-RUN.yml`, builds manifest + `--by-repo` shards.
3. Optional: `revkg scan` for graph substrate.
4. Workboard note: `audit-run:<slug>` claimed for coordination.
5. Do not claim a shard in the open step.

### Phase B — Shard execution (N sessions)

For each shard:

1. Claim (`claim-shard.js`).
2. For each path: full Read; classify; coverage + findings JSONL append.
3. Large files: paginate Read with offset/limit until `lines_read[1] === manifest.lines`.
4. Binary: `blocked` or `skipped-generated` with reason (do not pretend to "read" bytes as text).
5. `--complete` the shard (status `done`). `--release` only to abandon. Update progress.

### Phase C — Cross-check pass

Not every path needs L4, but these do:

- Auth, billing, licenses, webhooks, MCP, secrets loaders
- Public marketing claims vs code (`validate:claims` if in monorepo)
- Dual sources of truth (env, SECURITY_PATHS class, docs)

Use `kg_neighbors` / grep for callers after body read.

### Phase D — Close

1. `coverage-status.js` exit 0.
2. `reports/final.md` with finding index and gap promotions.
3. `AUDIT-RUN.yml` status closed.
4. Handoff fragment + optional kg_add_episode summary.

## Concurrency rules

- Shards are the unit of parallelism (path sets disjoint).
- Findings may race: use unique `F-` prefixes per agent (`F-g1-0001`).
- Never rewrite another agent's coverage row; append superseding row (last wins in status tool).
- Serial resume: pick first `status: open` shard. Skip `done`.
- `--mode code` (default) does not treat MD-truth C3 statuses as terminal. Use `--mode md-truth` only for GAP-407 runs.

## Correctness standard

"Verified and correct" means for this audit:

1. File content matches the role the path implies (or finding filed).
2. No secret material committed (or finding).
3. Docs that assert behavior match code, or drift finding (code wins).
4. TODOs without tracking → finding + optional gap.
5. Intentional duplication labeled `intent-dup`, not "fix me".

## Anti-patterns

- Sampling "representative" packages only
- Closing run with missing coverage
- Implementing fixes mid-audit without gap/PR discipline
- Treating KG scan as line coverage
- Overlapping claims

## Relation to audit-first SDLC

Audit-first SDLC is **before a change**. Exhaustive audit is **periodic or program-level** verification of an entire tree. Both cite file:line; this framework adds the coverage ledger so multi-session work cannot silently drop paths.
