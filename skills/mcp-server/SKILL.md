---
name: mcp-server
description: Model Context Protocol server development patterns. Use when building custom MCP servers, exposing tools and resources, handling JSON-RPC, implementing credential isolation, or integrating with Claude Desktop, Cursor, or AI agents. Covers @modelcontextprotocol/sdk, StdioServerTransport, tool schemas, and multi-tenant credential patterns.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# MCP Server Development

## Server Scaffolding

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
);
```

## Tool Definition

Tools use JSON Schema for input validation:

```typescript
const TOOLS: Tool[] = [
  {
    name: 'my_tool',
    description: 'What this tool does and when to use it.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 10)', default: 10 },
        filters: {
          type: 'object',
          description: 'Optional filters',
          properties: {
            status: { type: 'string', enum: ['active', 'archived'] },
          },
        },
      },
      required: ['query'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
```

## Tool Dispatch

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const startTime = Date.now();
  const toolName = request.params.name;

  try {
    let data: unknown;

    switch (toolName) {
      case 'my_tool': {
        const { query, limit = 10 } = request.params.arguments as {
          query: string;
          limit?: number;
        };
        data = await myApiCall(query, limit);
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown tool: ${toolName}` }],
          isError: true,
        };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data,
          _meta: {
            durationMs: Date.now() - startTime,
            server: 'my-server',
            tool: toolName,
            timestamp: new Date().toISOString(),
          },
        }, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      isError: true,
    };
  }
});
```

## Server Startup

```typescript
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
```

## Credential Isolation

For multi-tenant servers, use a credential override pattern:

```typescript
let _credentialOverrides: Record<string, string> = {};

export function setCredentials(creds: Record<string, string>): void {
  _credentialOverrides = creds;
}

// In tool handler:
const apiKey = _credentialOverrides.API_KEY ?? process.env.API_KEY;
if (!apiKey) {
  return { content: [{ type: 'text', text: 'Error: API_KEY not set' }], isError: true };
}
```

The hypervisor calls `setCredentials()` with tenant-scoped credentials before each invocation.

## HTTP API Helper Pattern

```typescript
function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'MyServer-MCP/0.1.0',
  };
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const { apiUrl, token } = getConfig();
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data;
}
```

## Hypervisor Registration

```typescript
hypervisor.registerServer({
  name: 'my-server',
  command: 'node',
  args: ['dist/servers/my-server.js'],
  env: { API_KEY: 'resolved-at-spawn' },
  requiredTier: 'pro',
});
```

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/dist/servers/my-server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

## Response Format

Always return `content` array with `type: 'text'`:

```typescript
// Success
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
};

// Error
return {
  content: [{ type: 'text', text: `Error: ${message}` }],
  isError: true,
};
```

## Best Practices

- Validate all inputs before API calls
- Include `_meta` with duration, server name, tool name, timestamp
- Use descriptive tool names with a namespace prefix (e.g., `stripe_`, `memory_`)
- Keep tool descriptions actionable: what it does, when to use it
- Set `required` only for truly required fields; use defaults for optional
- Handle timeouts gracefully (AbortController with 10-30s limits)
- Log errors server-side but return clean error messages to clients
