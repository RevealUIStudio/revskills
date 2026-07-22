# Redundancy / deprecation methodology

## Three different problems

| Problem | Definition | Typical fix |
|---------|------------|-------------|
| **Duplication** | Same or near-same implementation in ≥2 places | Consolidate to one primitive |
| **Redundancy** | Two *mechanisms* for one concern (even if not byte-identical) | Pick owner; delete or facade the other |
| **Deprecation** | Marked obsolete but still present / still imported | Remove or finish migration |

Exact hash dups are the easy end of duplication. Redundancy includes dual SECURITY_PATHS lists, dual loggers, dual env loaders, dual harness skill packs.

## Classification rules (mandatory)

Before any delete or merge:

1. **INTENTIONAL** — decoupling, circular-dep avoidance, public facade, test isolation, vendor boundary. Document and leave.
2. **ACCIDENTAL** — drift, copy-paste, incomplete consolidation, parallel rewrite abandoned mid-way. Consolidate.
3. **TRANSITIONAL** — deprecated with active migration; keep until cutover date in a gap.

If unsure: leave + gap, do not silent-delete.

## Canonical examples of intentional duals (fleet)

- Package isolation loggers that must not import `@revealui/utils` (dependency direction).
- Contracts types re-exported for public API vs internal drizzle types.
- Test fixtures that deliberately do not share production modules.
- Thin `index.ts` facades that re-export for ergonomics.

## Detector limitations

| Detector | False positives | False negatives |
|----------|-----------------|-----------------|
| Exact hash | Generated twins, vendored copies | Near-clones (renamed vars) |
| Markers | Historical comments | Dead code never marked deprecated |
| Basename | Common names if not allowlisted | Different names, same logic |

Always sample-read before PR.

## Relation to fleet-redundancy lane

The lane + remediation spec own **program prioritization** and multi-PR DAG. This skill owns **repeatable detection + classification workflow** any session can run without unpausing the whole lane. Findings feed gaps or the lane when owner resumes.

## Output hygiene

- Store runs under `REVFLEET_ARCHIVE/audits/` (fleet shared archive), not inside product git.
- Promote only accidental clusters to tracked work units.
- Public PRs never cite private planning paths.
