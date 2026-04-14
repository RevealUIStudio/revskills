---
name: vitest-testing
description: Vitest testing patterns for production TypeScript projects. Use when writing tests, fixing test failures, configuring coverage, mocking modules, debugging flaky tests, or setting up Vitest in a monorepo. Covers Vitest 3+, vi.mock, vi.fn, React Testing Library, PGlite in-memory PostgreSQL, pool forks, maxWorkers, and hookTimeout.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Vitest Testing Patterns

## Test File Conventions

- Unit/integration tests: `*.test.ts` or `*.test.tsx` (co-located with source)
- Test directories: `__tests__/` for grouped tests
- Fixtures: `__fixtures__/` or `test/fixtures/`
- Test utilities: shared test package or `test/helpers.ts`

## Writing Tests

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('MyFunction', () => {
  it('should handle the happy path', () => {
    const result = myFunction('valid-input');
    expect(result).toEqual({ status: 'ok' });
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction('')).toThrow('Input required');
  });
});
```

## Mocking

```typescript
// Mock a module
vi.mock('./database', () => ({
  query: vi.fn().mockResolvedValue([{ id: 1 }]),
}));

// Mock a class (Biome-safe — use class syntax, not function)
vi.mock('./service', () => ({
  MyService: class {
    async getData() { return []; }
  },
}));

// Spy on a method
const spy = vi.spyOn(object, 'method');
spy.mockReturnValue('mocked');
```

**Important:** When using Biome, always mock classes with `class` syntax inside `vi.mock()` factories. Biome converts `function()` to arrow functions, which breaks `new`.

## Async Testing

```typescript
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toHaveLength(3);
});

it('should reject on error', async () => {
  await expect(fetchBadData()).rejects.toThrow('Not found');
});
```

## PGlite (In-Memory PostgreSQL)

```typescript
import { PGlite } from '@electric-sql/pglite';

let db: PGlite;

beforeEach(async () => {
  db = new PGlite(); // in-memory, fresh each test
  await db.exec(schema);
});

afterEach(async () => {
  await db.close();
});
```

**Config for PGlite:** PGlite startup can take 3-5s under load. Set `hookTimeout: 30000` in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    hookTimeout: 30000,
  },
});
```

## Monorepo Testing

```typescript
// vitest.config.ts — per-package config
export default defineConfig({
  test: {
    pool: 'forks',       // process isolation (not threads)
    maxWorkers: 2,       // prevent OOM in CI
    hookTimeout: 30000,  // PGlite startup time
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- Use `pool: 'forks'` for process isolation (prevents shared state leaks)
- Cap `maxWorkers` to prevent fork explosion (turbo concurrency x workers = total processes)
- Disable test caching in turbo (`"cache": false` in turbo.json test task) to prevent stale results

## Coverage

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

## Common Mistakes to Avoid

1. Don't use `jest.fn()` — use `vi.fn()` (Vitest, not Jest)
2. Don't mock everything — prefer real implementations, mock only external services
3. Don't use `function()` in `vi.mock()` factories — Biome converts to arrows, breaking `new`
4. Don't share state between tests — use `beforeEach` to reset
5. Don't use threads pool with native modules — use `forks`
6. Don't set `hookTimeout` too low when using PGlite

## Debugging Flaky Tests

1. Check for shared mutable state between tests
2. Check for timing issues (`setTimeout`, `setInterval`)
3. Check for port conflicts (parallel workers binding same port)
4. Check for PGlite startup timeout under load
5. Run with `--reporter=verbose` to see individual test timings
6. Run single test: `vitest run src/path/to/file.test.ts`

---

*Skill by [RevealUI Studio](https://revealui.com) — the agentic business runtime.*
