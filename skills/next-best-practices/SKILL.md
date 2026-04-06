---
name: next-best-practices
description: |
  Next.js 15+ App Router best practices. Use when building pages, layouts, routes,
  server components, server actions, caching, or API routes. Covers RSC patterns,
  PPR, streaming, metadata, error boundaries, and proxy.ts conventions.
allowed-tools: Read Grep Glob
---

# Next.js Best Practices (App Router, v15+)

## Server Components (default)

- All components are Server Components by default — no `'use client'` needed
- Only add `'use client'` when you need: hooks, event handlers, browser APIs, or Context
- Prefer server components for data fetching — no useEffect, no loading states
- Pass server data to client components as props (serializable only)

## Route Conventions

- `page.tsx` — route page
- `layout.tsx` — shared layout (wraps children, persists across navigations)
- `loading.tsx` — streaming fallback (instant loading UI)
- `error.tsx` — error boundary (`'use client'` required)
- `not-found.tsx` — 404 page
- `proxy.ts` — request proxy/middleware (NOT `middleware.ts` in v16+)
- `route.ts` — API route handler

## Data Fetching

- Fetch in server components directly (no `getServerSideProps`)
- Use `fetch()` with Next.js caching extensions
- Deduplicate requests — React auto-deduplicates identical fetches per render
- For mutations: server actions (`'use server'`)

## Caching Strategy

```typescript
// Static (build time)
export const dynamic = 'force-static';

// Dynamic (every request)
export const dynamic = 'force-dynamic';

// ISR (revalidate every N seconds)
export const revalidate = 3600;

// On-demand revalidation
import { revalidatePath, revalidateTag } from 'next/cache';
```

## Partial Prerendering (PPR)

- Enable in `next.config.ts`: `experimental: { ppr: true }`
- Static shell renders instantly, dynamic parts stream in
- Use `<Suspense>` boundaries to mark dynamic regions
- No code changes needed — just wrap dynamic content in Suspense

## Metadata

```typescript
// Static
export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description',
};

// Dynamic
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await fetchData(params.id);
  return { title: data.title };
}
```

## Server Actions

```typescript
'use server';

export async function createItem(formData: FormData) {
  const name = formData.get('name') as string;
  // Validate, write to DB, revalidate
  revalidatePath('/items');
}
```

- Always validate input (use Zod)
- Always revalidate affected paths after mutations
- Return errors as values, not thrown exceptions

## Image Optimization

```tsx
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Description"
  width={1200}
  height={630}
  priority // above the fold
  placeholder="blur"
/>
```

## Common Mistakes to Avoid

1. Don't use `'use client'` on pages that don't need interactivity
2. Don't fetch data in client components when server components work
3. Don't use `useEffect` for data fetching — use server components or server actions
4. Don't put `middleware.ts` at the root — use `proxy.ts` in Next.js 16+
5. Don't use `router.push()` for mutations — use server actions + `revalidatePath()`
6. Don't wrap entire pages in Suspense — wrap individual dynamic sections

## React 19 Conventions

- No `useCallback`, `useMemo`, or `React.memo` — React Compiler handles memoization
- Use `use()` instead of `useContext()` for reading context
- Use ternary `{condition ? <A/> : null}` instead of `{condition && <A/>}`
- `ref` is a regular prop now — no `forwardRef` needed

---

*Skill by [RevealUI Studio](https://revealui.com) — the agentic business runtime.*
