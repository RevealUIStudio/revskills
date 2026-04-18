---
name: yjs-collaboration
description: Yjs CRDT collaboration patterns for real-time and offline-first editing. Use when building collaborative documents, shared scratchpads, or multi-user editing. Covers Y.Doc, Y.Map, Y.Array, Y.Text, state encoding, structured patches, server-side document manipulation, and conflict-free merge semantics.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Yjs CRDT Collaboration

## Core Concepts

Yjs is a CRDT framework. Multiple peers can edit concurrently and merge without conflicts. Every operation is commutative and idempotent.

```typescript
import * as Y from 'yjs';

const doc = new Y.Doc();
const root = doc.getMap('root');
```

## Type System

| Type | Use Case | API |
|------|----------|-----|
| `Y.Map` | Key-value store | `set(key, val)`, `get(key)`, `delete(key)` |
| `Y.Array` | Ordered list | `push([item])`, `insert(idx, [item])`, `delete(idx, len)` |
| `Y.Text` | Rich/plain text | `insert(idx, str)`, `delete(idx, len)`, `toString()` |

Nested types: Y.Map values can be other shared types.

```typescript
const root = doc.getMap('root');

// String values
root.set('title', 'My Document');

// Nested Y.Text
const findings = new Y.Text();
findings.insert(0, 'Initial finding...');
root.set('findings', findings);

// Nested Y.Array
const items = new Y.Array();
items.push(['Item 1', 'Item 2']);
root.set('items', items);
```

## State Encoding & Persistence

```typescript
// Encode full state as a binary update
const state = Y.encodeStateAsUpdate(doc);       // Uint8Array
const vector = Y.encodeStateVector(doc);          // Uint8Array

// Persist to database (Postgres bytea column)
await db.update(documents)
  .set({
    state: Buffer.from(state),
    stateVector: Buffer.from(vector),
  })
  .where(eq(documents.id, docId));

// Restore from database
const doc = new Y.Doc();
Y.applyUpdate(doc, new Uint8Array(storedState));
```

## Server-Side Document Manipulation

For CLI agents or batch processes that cannot use WebSocket:

```typescript
import * as Y from 'yjs';

function applyStructuredPatch(
  existingState: Uint8Array | null,
  patchType: string,
  path: string,
  content: string,
): { state: Uint8Array; stateVector: Uint8Array } {
  const doc = new Y.Doc();

  if (existingState) {
    Y.applyUpdate(doc, existingState);
  }

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

  const result = {
    state: Y.encodeStateAsUpdate(doc),
    stateVector: Y.encodeStateVector(doc),
  };

  doc.destroy();
  return result;
}
```

## Reading Document Content

```typescript
function readDocument(state: Uint8Array): Record<string, unknown> {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const root = doc.getMap('root');
  const result: Record<string, unknown> = {};

  for (const [key, value] of root.entries()) {
    if (value instanceof Y.Text) {
      result[key] = value.toString();
    } else if (value instanceof Y.Array) {
      result[key] = value.toArray();
    } else {
      result[key] = value;
    }
  }

  doc.destroy();
  return result;
}
```

## Merging Two Documents

```typescript
// Two docs edited independently
const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

// ... edits happen on each ...

// Merge: apply each doc's state to the other
const state1 = Y.encodeStateAsUpdate(doc1);
const state2 = Y.encodeStateAsUpdate(doc2);

Y.applyUpdate(doc1, state2); // doc1 now has both edits
Y.applyUpdate(doc2, state1); // doc2 now has both edits
// Both docs are identical after merge
```

## Database Schema

```sql
CREATE TABLE yjs_documents (
  id TEXT PRIMARY KEY,
  state BYTEA NOT NULL,
  state_vector BYTEA,
  connected_clients INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## WebSocket Provider (Real-Time)

For browser agents that need live character-by-character collaboration:

```typescript
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();
const provider = new WebsocketProvider(
  'wss://collab.example.com',
  'document-id',
  doc,
);

provider.on('status', ({ status }) => {
  console.log('Connection:', status); // 'connecting' | 'connected' | 'disconnected'
});
```

## Awareness (Presence)

```typescript
const awareness = provider.awareness;

// Set local state (cursor position, user info)
awareness.setLocalState({
  user: { name: 'Agent A', color: '#ff0000' },
  cursor: { index: 42, length: 0 },
});

// Listen for remote state changes
awareness.on('change', () => {
  const states = awareness.getStates();
  // Map<clientId, { user, cursor }>
});
```

## Best Practices

- Always call `doc.destroy()` after server-side operations to free memory
- Use `Buffer.from(state)` when storing in Postgres bytea columns
- Use `new Uint8Array(buffer)` when reading from Postgres bytea columns
- Prefer `Y.Text` over plain strings for content that may be collaboratively edited
- Use `Y.Array` for ordered lists (append-heavy patterns)
- Use `Y.Map` as the root container for structured documents
- Server-side patches and WebSocket edits merge cleanly via CRDT semantics
