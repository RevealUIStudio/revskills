---
name: drizzle-db
description: |
  Drizzle ORM schema design, migrations, and query patterns. Use when creating tables,
  writing queries, managing migrations, or working with PostgreSQL via Drizzle.
  Covers relations, indexes, enums, JSON columns, and NeonDB/Supabase patterns.
allowed-tools: Read Grep Glob
---

# Drizzle ORM Patterns

## Schema Definition

```typescript
import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'user', 'guest'] }).notNull().default('user'),
  metadata: jsonb('metadata').$type<UserMetadata>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('users_email_idx').on(table.email),
]);
```

## Relations

```typescript
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

## Queries

```typescript
// Select with relations
const result = await db.query.users.findMany({
  where: eq(users.role, 'admin'),
  with: { posts: true },
  limit: 10,
});

// Insert
const [newUser] = await db.insert(users)
  .values({ email: 'user@example.com', name: 'User' })
  .returning();

// Update
await db.update(users)
  .set({ name: 'Updated' })
  .where(eq(users.id, userId));

// Delete
await db.delete(users).where(eq(users.id, userId));

// Transaction
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(userData).returning();
  await tx.insert(profiles).values({ userId: user.id });
});
```

## Migrations

```bash
# Generate migration from schema changes
drizzle-kit generate

# Apply migrations
drizzle-kit migrate

# Push schema directly (dev only)
drizzle-kit push
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## NeonDB (Serverless)

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });
```

- Use `neon-http` driver for serverless (one-shot queries, no persistent connection)
- Use `neon-serverless` with WebSocket for transactions
- Branch databases for dev/test/staging

## Common Patterns

### Soft Delete
```typescript
export const posts = pgTable('posts', {
  // ...
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Always filter
const activePosts = await db.query.posts.findMany({
  where: isNull(posts.deletedAt),
});
```

### Pagination
```typescript
const page = await db.query.posts.findMany({
  limit: 20,
  offset: (pageNum - 1) * 20,
  orderBy: [desc(posts.createdAt)],
});
```

### Type-Safe JSON
```typescript
interface UserPrefs {
  theme: 'light' | 'dark';
  notifications: boolean;
}

export const users = pgTable('users', {
  prefs: jsonb('prefs').$type<UserPrefs>().default({ theme: 'light', notifications: true }),
});
```

## Common Mistakes to Avoid

1. Don't use raw SQL when Drizzle query builder works
2. Don't skip `.returning()` on insert/update when you need the result
3. Don't forget indexes on columns used in WHERE clauses
4. Don't use `drizzle-kit push` in production — use migrations
5. Don't store dates without timezone — always use `{ withTimezone: true }`
6. Don't forget to close connections in serverless (use connection pooling)

---

*Skill by [RevealUI Studio](https://revealui.com) — the agentic business runtime.*
