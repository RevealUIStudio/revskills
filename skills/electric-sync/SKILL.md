---
name: electric-sync
description: ElectricSQL v1.x real-time sync patterns for PostgreSQL. Use when setting up shape subscriptions, authenticated proxy routes, mutation endpoints, offline-first sync, or connecting Electric to Neon/Supabase. Covers read-only sync, row-level filtering, write-through-API, and conflict resolution.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# ElectricSQL Sync Patterns

## Architecture

Electric v1.x is **read-only sync**: Postgres WAL -> Electric -> clients via HTTP. Writes go through your own API. Electric picks up WAL changes and pushes to shape subscribers.

```
Postgres (Neon/Supabase) --> Electric (sync service) --> Clients (HTTP shapes)
         ^                                                    |
         |                                                    v
         +--- Your API <--- REST mutations <--- Client writes
```

## Shape Proxy Route (Next.js)

Authenticated proxy that adds row-level filtering before forwarding to Electric:

```typescript
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers);
  if (!session) return unauthorized();

  const scopeId = new URL(request.url).searchParams.get('scope_id');
  if (!scopeId || !/^[a-zA-Z0-9_-]+$/.test(scopeId)) return validationError();

  const originUrl = prepareElectricUrl(request.url);
  originUrl.searchParams.set('table', 'your_table');
  originUrl.searchParams.set('where', `scope_id = '${scopeId}'`);

  return proxyElectricRequest(originUrl);
}
```

Key points:
- Always validate and sanitize WHERE clause inputs (alphanumeric, UUID regex)
- Set `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'`
- Use `force-dynamic` to prevent Next.js from caching the proxy response

## Mutation Route (Write Path)

Writes go through REST, then Electric picks up the WAL change:

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers);
  if (!session) return unauthorized();

  const body = await request.json();
  // Validate body fields

  const db = getClient();
  const [created] = await db.insert(table).values({ ... }).returning();

  // Electric automatically syncs this to all shape subscribers
  return NextResponse.json(created, { status: 201 });
}
```

## Client Hook (React)

```typescript
import { useShape } from '@electric-sql/react';

function useMyData(scopeId: string) {
  const { proxyBaseUrl } = useElectricConfig();

  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/my-table`,
    params: { scope_id: scopeId },
  });

  return { data, isLoading, error };
}
```

## Database Requirements

- PostgreSQL 14+ with `wal_level = logical`
- Direct connection (not pooled) for replication
- Neon: logical replication available on all plans
- Supabase: logical replication enabled by default

## Electric Configuration

```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
ELECTRIC_SECRET=your-secret-key
```

Health check: `GET /v1/health` returns `{"status":"active"}`

## Offline-First Pattern

```typescript
import { useShape } from '@electric-sql/react';

// Shape data is cached locally. When reconnecting,
// Electric resumes from the last sync position.
const { data, isLoading } = useShape({
  url: `${proxyBaseUrl}/api/shapes/my-table`,
  params: { scope_id: id },
  fetchClient: fetchWithTimeout, // 10s timeout
});
```

## Row-Level Security

All filtering happens server-side in the proxy route. Never trust client-provided WHERE clauses:

```typescript
// Good: server derives the filter from the authenticated session
originUrl.searchParams.set('where', `user_id = '${session.user.id}'`);

// Bad: client controls the filter
originUrl.searchParams.set('where', request.searchParams.get('filter'));
```

## Conflict Resolution

Electric is read-only sync. Conflicts happen at the write API level:

- **Last-write-wins**: Compare timestamps, keep latest
- **Server-wins**: Always accept server state on 409
- **Optimistic**: Use `If-Match` / `ETag` headers for version checks
- **Queue**: Buffer offline mutations, replay on reconnect with coalescing
