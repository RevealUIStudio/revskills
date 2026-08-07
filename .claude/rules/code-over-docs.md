# Code Over Docs — Source of Truth Is Always the Source Code

**Status:** convention. Applies to every repo and every session.

## The rule

The source code is the single source of truth. Documentation (READMEs, specs,
plans, handoffs, ADRs, comments, backlog items, memory) *describes* the
system; the code *defines* it. When a doc and the code disagree, the code is
correct and the doc is stale. Full stop.

## How to apply

1. **Verify against code before acting.** Never implement, review, plan, or
   report from a doc claim alone. Every load-bearing claim gets grounded to
   `file:line` in the actual source before it drives a decision.
2. **On disagreement: trust code, then fix the doc.** A doc-vs-code conflict
   is a doc bug. Act on what the code does; queue or commit the doc
   correction so the drift dies instead of propagating. Never "fix" working
   code to match a stale doc without an explicit decision that the doc's
   description was the intended behavior.
3. **Doc-tier authority is subordinate.** Whatever authority hierarchy your
   team uses for doc-vs-doc conflicts (roadmap over handoff over working
   notes, or similar) resolves doc-vs-doc conflicts only. Code outranks every
   tier on any factual claim about system behavior.
4. **Prioritize code work over doc work.** When triaging a backlog, changes
   that make the code correct outrank changes that make the prose about the
   code nicer. Doc sweeps ride behind, never ahead of, the code fixes they
   describe.
5. **Comments are docs too.** A stale comment (for example, a header
   describing a retired format) is drift. Fix it when touching the file, but
   trust the code path below it, not the comment above it.

## Why

Docs rot by default. Shipped code pivots that never propagate to prose are
the single biggest source of stale documentation, and requests to "do this"
often turn out to already be done in code, just not yet reflected in the docs
someone read first. Reading docs without grounding claims in code produces
duplicate work and phantom bugs.
