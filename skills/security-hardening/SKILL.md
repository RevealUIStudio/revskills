---
name: security-hardening
description: Web application security hardening for OWASP Top 10 vulnerabilities. Use when implementing authentication, HTTP security headers, CORS, rate limiting, input validation, or reviewing code for XSS, SQL injection, CSRF, or SSRF. Covers CSP, HSTS, session cookies, bcrypt, Zod validation, and secrets management.
license: MIT
allowed-tools: Read, Grep, Glob
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
---

# Security Hardening Patterns

## HTTP Security Headers

```typescript
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0', // Disabled — CSP is the modern replacement
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};
```

## CORS

```typescript
const corsOptions = {
  origin: ['https://app.example.com'], // Never use '*' with credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400,
};
```

- Never use `origin: '*'` with `credentials: true`
- Whitelist specific origins, never reflect the Origin header
- Set `maxAge` to reduce preflight requests

## Authentication (Session-Based)

```typescript
// Session cookie settings
const sessionCookie = {
  httpOnly: true,    // No JavaScript access
  secure: true,      // HTTPS only
  sameSite: 'lax',   // CSRF protection
  maxAge: 86400,     // 24 hours
  path: '/',
};

// Password hashing (bcrypt, 12+ rounds)
import { hash, compare } from 'bcrypt';
const ROUNDS = 12;
const hashed = await hash(password, ROUNDS);
const valid = await compare(input, hashed);
```

- Session-only auth (no JWT in cookies — JWTs can't be revoked)
- bcrypt with 12+ rounds (not MD5, SHA-256, or plain text)
- httpOnly cookies prevent XSS token theft
- sameSite=lax prevents CSRF on state-changing requests

## Input Validation

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user']),
});

// Validate at system boundaries
export async function createUser(input: unknown) {
  const data = CreateUserSchema.parse(input); // throws on invalid
  // ... safe to use data
}
```

- Validate ALL external input (user input, API requests, webhooks)
- Use Zod schemas — never trust `typeof` or manual checks
- Validate at system boundaries, trust internal code
- Set reasonable max lengths to prevent abuse

## Rate Limiting

```typescript
// Per-endpoint rate limiting
const rateLimiter = {
  '/api/auth/sign-in': { windowMs: 15 * 60 * 1000, max: 10 },  // 10 per 15 min
  '/api/auth/sign-up': { windowMs: 60 * 60 * 1000, max: 5 },   // 5 per hour
  '/api/webhooks':     { windowMs: 60 * 1000, max: 100 },       // 100 per minute
  '/api/*':            { windowMs: 60 * 1000, max: 300 },        // 300 per minute (default)
};
```

## XSS Prevention

- Never use `dangerouslySetInnerHTML` without sanitization
- Validate URLs: block `javascript:`, `vbscript:`, `data:` schemes
- Use CSP to prevent inline script execution
- Escape user content in HTML attributes

```typescript
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

## SQL Injection Prevention

- Use parameterized queries (Drizzle ORM does this automatically)
- Never concatenate user input into SQL strings
- Use `sql.placeholder()` for dynamic queries

```typescript
// Safe (parameterized)
const users = await db.select().from(usersTable).where(eq(usersTable.email, userInput));

// DANGEROUS — never do this
const users = await db.execute(`SELECT * FROM users WHERE email = '${userInput}'`);
```

## Secrets Management

- Never commit `.env` files, API keys, or credentials
- Prefer a single encrypted vault (or platform secret store) as source of truth; inject at runtime
- **RevealUI Studio / RevFleet:** secrets live in **revvault** (`revvault run --env KEY=path -- cmd` / `with-secrets`). Env vars are a downstream injection surface, not the store. See fleet `secrets` hardline.
- Generic apps: environment variables or managed secret stores; never hardcode
- Rotate credentials after any suspected exposure
- Scan for secrets in CI (Gitleaks, GitHub Secret Scanning)

## OWASP Top 10 Checklist

1. **Broken Access Control** — enforce on every endpoint, not just UI
2. **Cryptographic Failures** — bcrypt for passwords, TLS everywhere
3. **Injection** — parameterized queries, input validation
4. **Insecure Design** — threat model before coding
5. **Security Misconfiguration** — security headers, disable debug in prod
6. **Vulnerable Components** — audit dependencies, pin versions
7. **Authentication Failures** — rate limit, brute force protection
8. **Data Integrity Failures** — verify webhook signatures, validate JWTs
9. **Logging Failures** — log auth events, don't log secrets
10. **SSRF** — validate URLs, block internal networks

---

*Skill by [RevealUI Studio](https://revealui.com) — the agentic business runtime.*
