---
name: multi-agent-memory
description: Multi-agent shared memory patterns for AI agent coordination. Use when building shared fact logs, collaborative scratchpads, memory reconciliation, or coordinating discoveries between concurrent agents. Covers append-only fact tables, Yjs CRDT scratchpads, LLM-powered reconciliation, and session-scoped memory sharing.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Multi-Agent Shared Memory

## Architecture Overview

Three layers, each building on the previous:

```
Layer 1: Shared Fact Log      — append-only discoveries, real-time sync
Layer 2: Yjs CRDT Scratchpad  — collaborative working document
Layer 3: Reconciliation       — LLM-powered canonical fact extraction
```

All layers scope by `session_id` (coordination session). Only agents in the same session share memory.

## Layer 1: Shared Fact Log

Append-only table of agent discoveries. No CRDT, no merge — pure append.

```sql
CREATE TABLE shared_facts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  fact_type TEXT NOT NULL CHECK (fact_type IN (
    'discovery', 'bug', 'decision', 'warning', 'question', 'answer'
  )),
  confidence REAL NOT NULL DEFAULT 1.0,
  tags JSONB NOT NULL DEFAULT '[]',
  source_ref JSONB,
  superseded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Write path: agent publishes via REST API -> DB insert -> Electric syncs to subscribers.

```typescript
// Publishing a fact
await fetch('/api/sync/shared-facts', {
  method: 'POST',
  body: JSON.stringify({
    session_id: 'coord-abc123',
    agent_id: 'claude-1',
    content: 'auth module has race condition in session refresh',
    fact_type: 'bug',
    confidence: 0.9,
    tags: ['auth', 'concurrency'],
    source_ref: { file: 'src/auth/session.ts', line: 42 },
  }),
});
```

Read path (React): subscribe via Electric shape.

```typescript
function useSharedFacts(sessionId: string) {
  const { data, isLoading } = useShape({
    url: `${proxyBaseUrl}/api/shapes/shared-facts`,
    params: { session_id: sessionId },
  });
  return { facts: data, isLoading };
}
```

Read path (CLI agents): poll via daemon RPC or direct API call.

## Layer 2: Yjs CRDT Scratchpad

Multiple agents concurrently edit a shared document. Browser agents use WebSocket Yjs collab. CLI agents submit structured patches applied server-side.

### Patch Types

| Type | Description | Example |
|------|-------------|---------|
| `set_key` | Set root-level key to string | Title, status |
| `append_section` | Append to Y.Text section | Add findings |
| `append_item` | Push to Y.Array section | Add list item |
| `replace_section` | Replace section entirely | Rewrite plan |

### Structured Patch (CLI Agents)

```typescript
await fetch('/api/sync/yjs-document-patches', {
  method: 'POST',
  body: JSON.stringify({
    document_id: 'scratchpad-task-42',
    agent_id: 'claude-2',
    patch_type: 'append_item',
    path: 'findings',
    content: 'Database index missing on user_id column',
  }),
});
```

Server-side: loads Y.Doc state, applies patch, saves updated state. Electric fans out.

### Server-Side Patch Application

```typescript
import * as Y from 'yjs';

function applyPatch(doc: Y.Doc, patchType: string, path: string, content: string) {
  const root = doc.getMap('root');
  switch (patchType) {
    case 'set_key':
      root.set(path, content);
      break;
    case 'append_section': {
      let section = root.get(path);
      if (!(section instanceof Y.Text)) {
        section = new Y.Text();
        root.set(path, section);
      }
      section.insert(section.length, content);
      break;
    }
    case 'append_item': {
      let arr = root.get(path);
      if (!(arr instanceof Y.Array)) {
        arr = new Y.Array();
        root.set(path, arr);
      }
      arr.push([content]);
      break;
    }
    case 'replace_section': {
      const text = new Y.Text();
      text.insert(0, content);
      root.set(path, text);
      break;
    }
  }
}
```

## Layer 3: Reconciliation

Periodic or on-demand LLM pass that reads the fact log, resolves contradictions, deduplicates, and produces canonical memories.

### Extending Existing Memory Tables

```sql
ALTER TABLE agent_memories ADD COLUMN scope TEXT DEFAULT 'private';
-- Values: 'private' (single agent), 'shared' (session-wide), 'reconciled' (LLM-verified)
ALTER TABLE agent_memories ADD COLUMN session_scope TEXT;
ALTER TABLE agent_memories ADD COLUMN source_facts JSONB DEFAULT '[]';
ALTER TABLE agent_memories ADD COLUMN reconciled_at TIMESTAMPTZ;
```

### Reconciliation Process

1. Query unreconciled facts (where `superseded_by IS NULL`)
2. Group related facts by tags, source references, semantic similarity
3. LLM prompt: determine canonical truths, contradictions, duplicates
4. Create `scope = 'reconciled'` memories with `source_facts` references
5. Mark source facts as `superseded_by` the new reconciled memory

### Heuristic Fallback (No LLM)

Normalize content, deduplicate by exact match, keep highest confidence per group.

## CLI vs Browser Agent Paths

| Action | Browser Agent | CLI Agent |
|--------|---------------|-----------|
| Read facts | Electric shape (real-time) | API poll or daemon RPC |
| Write facts | REST POST | Daemon RPC -> REST POST |
| Edit scratchpad | WebSocket Yjs (live) | Structured patches |
| Read scratchpad | Yjs doc state | API -> decoded JSON |
| Trigger reconciliation | REST POST | Daemon RPC -> REST POST |

## Session Scoping

All memory is scoped by coordination session ID. When agents start a shared task:

1. Generate or reuse a session ID (e.g., `coord-{taskId}`)
2. All fact publications include this session ID
3. Shape subscriptions filter by session ID
4. Reconciliation processes one session at a time
