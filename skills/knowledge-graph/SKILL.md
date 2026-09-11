---
name: knowledge-graph
description: Query the fleet knowledge graph before grep for cross-repo questions (what depends on X, where is Y enforced, what did the dependency graph look like on date D, what has any agent learned about Z). Covers the kg_* MCP tool surface, kg_context as the default entry point, point-in-time queries, publishing agent-fact episodes, and the revkg CLI equivalents. GAP-349.
license: MIT
allowed-tools: Bash, Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Fleet Knowledge Graph

## Relation to exhaustive audits

For multi-session **line-level** codebase audits, use the `exhaustive-audit`
skill first (path inventory + coverage ledger). The graph maps relationships
and history; it does **not** prove every file body was read. After inventory,
`revkg scan` / `kg_context` / `kg_neighbors` are the right tools for system
maps and blast-radius views.

## When to query the graph

The fleet knowledge graph is a bi-temporal, content-addressed graph of every
repo, package, file, exported symbol, dependency edge, db table, route,
skill, rule, hook, gap, lane, ADR, and agent discovery in revfleet. It is
searchable by hybrid retrieval (vector + full-text + graph traversal) and
every fact carries provenance back to the episode that produced it.

**Query-before-grep** for cross-repo or "what depends on this" questions:

- "What consumes `coordination_events` and what breaks if I rename it?" A
  traversal question. `grep` finds string matches; the graph finds edges.
- "Where is licensing enforced across the fleet?" A cross-repo hybrid
  search question. One query, not thirteen repo greps.
- "What did the dependency graph of `@revealui/ai` look like on June 1?" A
  point-in-time question `grep` cannot answer at all.
- "What has any agent ever learned about the Electric proxy?" A
  provenance question over agent-fact episodes.

Plain `grep`/`Read` still wins for single-file, single-repo, "show me this
exact function body" lookups. Reach for the graph when the question spans
repos, spans time, or asks about relationships rather than text.

## The MCP tool surface

Seven tools, all under `@revealui/mcp`'s `kg-server` factory
(`createKnowledgeGraphServer`), wrapping `@revealui/knowledge-graph`'s
search and ingest APIs. Studio attaches them with stdio
`revealui-mcp knowledge-graph`. Hosted clients use the same names on
governed `/api/mcp` (no second MCP URL).

| Tool | Use for |
|---|---|
| `kg_context` | **Default entry point.** Budgeted context assembly from an anchor node (see below). |
| `kg_search` | Open-ended hybrid search (vector + FTS + BFS), returns nodes and facts with provenance. |
| `kg_get_node` | Fetch one node plus its current facts by natural key. |
| `kg_neighbors` | BFS neighbors of a node, current or point-in-time. |
| `kg_path` | Shortest path between two nodes. |
| `kg_at_time` | A node's facts as of a timestamp. |
| `kg_add_episode` | The only write tool. Publish a durable episode (see below). |

Natural keys are the graph's stable node identifiers, e.g.
`revealui/packages/ai/src/llm/client.ts#getClient` for a symbol, or
`npm:zod` for an external dependency. `kg_search` finds a node's natural key
from a free-text query when you don't already know it.

Example calls (arguments shown as the tool's JSON input):

```json
{ "tool": "kg_search", "arguments": { "query": "licensing enforcement", "limit": 10 } }
```

```json
{ "tool": "kg_get_node", "arguments": { "naturalKey": "revealui/packages/paywall/src/index.ts#requireFeature" } }
```

```json
{ "tool": "kg_neighbors", "arguments": { "naturalKey": "revealui/packages/db/src/schema/coordination.ts", "depth": 2 } }
```

## `kg_context`: the default entry point

Before starting nontrivial work on an unfamiliar file, package, or gap,
pull its context first instead of grepping around blind:

```json
{
  "tool": "kg_context",
  "arguments": {
    "naturalKey": "revealui/packages/knowledge-graph/src/ingest/engine.ts",
    "depth": 2,
    "charBudget": 16000
  }
}
```

This runs a BFS from the anchor node, reranks by node-distance and
episode-mentions, and packs node summaries plus edge facts (each carrying
its provenance episode ids) into a text block capped at `charBudget`
characters (default 16000; characters, not tokens). In product mode the
packed string is `data.context` on the envelope (not the JSON root); the
same payload reports `truncated`, `charsUsed`, `nodeCount`, and
`factCount` so you know whether the packed block is the whole neighborhood
or a budgeted slice of it. Prefer this over `kg_search` when the question
is "what do I need to know before touching X." `kg_search` is for
open-ended queries where you don't yet have an anchor.

## Point-in-time query recipes

Every read tool except `kg_get_node` accepts an optional `at` (ISO-8601
timestamp). Omit it for the current graph; pass it to see the graph as it
was at that moment. Edges are never deleted, only invalidated, so history
is queryable, not reconstructed.

Recipes:

- **"What did X depend on before this refactor landed?"**
  `kg_neighbors` with `naturalKey` set to the package/file and `at` set to
  a timestamp just before the refactor's merge commit.
- **"What were the current facts about this node on a given date?"**
  `kg_at_time` with that date.
- **"Did this edge exist yet when I started this session?"**
  `kg_search` with `at` set to the session start time, then check whether
  the fact appears in `result.facts`.

A timestamp with no matching state simply returns fewer or no results.
There is no error for "too early," since `validAt`/`invalidAt` windows are
exact.

## Publishing agent-fact episodes

`kg_add_episode` is the only write tool. It is always additive (never a
rescan) and Zod-validates `episodeType`, every node `kind`, and every edge
`relation` against the graph's ontology enums server-side: invalid values
are rejected before anything is written, and there is no path to raw SQL or
table names through this tool.

Use it to durably record an end-of-session discovery instead of letting it
die in a handoff doc. This extends the `shared_facts` flow from the
`multi-agent-memory` skill: a `shared_facts` row is session-scoped and
ephemeral, while a `kg_add_episode` call with `episodeType: "agent-fact"`
becomes a permanent, queryable graph fact with full provenance. Product
mode stamps `source` and actor DID from the session principal — do not
pass `"source": "claude-session"`; the client field is ignored. See
`multi-agent-memory` for the durable vs working vs session table.

```json
{
  "tool": "kg_add_episode",
  "arguments": {
    "episodeType": "agent-fact",
    "content": "the Electric proxy retries with exponential backoff on 5xx",
    "classification": "workspace",
    "nodes": [
      {
        "kind": "concept",
        "name": "Electric proxy retry behavior",
        "naturalKey": "concept:electric-proxy-retry-backoff"
      }
    ],
    "edges": [
      {
        "source": { "kind": "concept", "naturalKey": "concept:electric-proxy-retry-backoff" },
        "target": { "kind": "file", "naturalKey": "revealui/apps/admin/src/lib/api/electric-proxy.ts" },
        "relation": "documents",
        "fact": "electric-proxy.ts retries with exponential backoff on 5xx"
      }
    ]
  }
}
```

**Explicit invocation only.** Publishing an episode is a deliberate act at
the point a discovery is worth keeping. There is no hook that
auto-publishes on session end or on every tool call. Call `kg_add_episode`
yourself when you have something durable to say, the same way you would
decide to write a `shared_facts` row.

## Launcher, identity, envelope

Studio stdio: `revealui-mcp knowledge-graph`. Set `REVDEV_AGENT_ID` so the
server can load the hook identity
(`REVDEV_HOOK_IDENTITY_DIR`, default
`~/.local/share/revealui/hook-identities`). Missing principal → envelope
`unavailable` / `principal-missing`, one WARN per process, then proceed.
Do not invent a session-named `source` to paper over it.

Hosted: same `kg_*` tools on `/api/mcp` with a device token. Tenant is the
caller's `accountId`, not `studio-local`.

Every product-mode JSON body is an envelope:

| `status` | Meaning |
|---|---|
| `ok` | `available: true`, `enforcement`, `deniedCount`, `data` |
| `denied` | In-scope result set empty and `deniedCount > 0`. Not an empty success. |
| `unavailable` | Graph down, timeout, or principal missing. Session continues. |

`ok` with empty lists and `deniedCount: 0` means nothing exists. Treat
`unavailable` as a WARN, not a silent empty graph.

If a discovery contradicts an existing edge, still just call
`kg_add_episode` with the corrected fact. The ingest engine's entity
resolution and re-scan diffing are for the deterministic scan path
(`revkg scan`), not for episode ingestion, so a contradicting agent-fact
episode lands as new provenance alongside the old one rather than silently
overwriting it. Note the contradiction in your `content` field so a human
or a future Tier-2 LLM pass can reconcile it.

## The `revkg` CLI equivalents

Every read-side MCP tool has a CLI counterpart for ad-hoc terminal use
(connects to Neon via `POSTGRES_URL`/`DATABASE_URL`, same as any other
fleet script):

```bash
revkg search "licensing enforcement" --limit 10
revkg node revealui/packages/paywall/src/index.ts#requireFeature
revkg neighbors revealui/packages/db/src/schema/coordination.ts --depth 2
revkg at revealui/packages/db/src/schema/coordination.ts 2026-06-01T00:00:00Z
revkg scan --repo revealui        # single repo, deterministic Tier-1 extractors
revkg scan --fleet                # every repo under the same parent directory
```

There is no CLI write path equivalent to `kg_add_episode`: `revkg scan`
only ever runs the deterministic re-scan path (`applyScan`), never additive
episode ingestion. Publishing an agent-fact episode is an MCP-tool-only
(or direct `ingestEpisode` API) action by design, since it is inherently an
agent (or human) asserting something, not a scan discovering it.

## Degradation behavior

Read tools work with no pgvector extension and no embedding model running:
the vector search channel is skipped whenever no query embedding is
available, falling back to full-text search plus BFS traversal. Don't
expect a `kg_search` failure just because Ollama is down. Expect slightly
lower recall on paraphrased queries, not an error.
