---
name: revvault-resolve
description: >
  Resolve API keys, credentials, secrets, tokens, and .env values from
  revvault. Use when the user asks for a key, secret, token, database URL,
  webhook secret, or to sign up / connect / provision Neon, Supabase,
  PlanetScale, Clerk, Auth0, Vercel, Netlify, Railway, Render, Fly,
  Cloudflare, Sentry, PostHog, Mixpanel, OpenRouter, Stripe, Twilio,
  Resend, or any third-party service; when they mention Stripe Projects,
  projects.dev, or "set up the stack." Never print values. Never open
  Stripe Projects. Look up the vault path, then inject with revvault run
  or with-secrets, or stop.
license: MIT
allowed-tools: Bash, Read, Grep
metadata:
  author: RevealUI Studio
  version: "0.1.0"
  website: https://revealui.com
  related:
    - security-hardening
---

# revvault-resolve

Studio skill. Secrets live in **revvault**. `.env` and host env vars are
mirrors. The CLI and the path tables are authoritative. Do not copy a
path catalog into this file.

Policy (do not restate the body): fleet `secrets` hardline, and
`revvault/docs/STREAM-SAFE.md`.

## When to use

Use this skill instead of Stripe Projects, a vendor dashboard, or
pasting a key when the user wants credentials, env vars, or to add a
cloud service.

Do **not** run `stripe projects` (`init`, `add`, `link`, `env --pull`,
`build`). Do **not** tell the user to sign up on a vendor site from
this skill. Account creation is owner disposition.

## Resolve (paths and names only)

1. Confirm `revvault` is on PATH. If missing, stop. Name it. Do not
   invent a substitute store.
2. Map the asked-for name (env key, vendor, or path token) in this
   order. Record **path**, **env key**, and **consumers** only.
   - If a revealui checkout is present (`$REVEALUI_ROOT` or
     `$HOME/revfleet/revealui`): read
     `scripts/sync/secret-paths.ts` and the generated table in
     `docs/SECRETS.md`. That module is the production-synced set
     (Phase 0). `dev/*`, `credentials/*`, `forge/*`, and `agents/*`
     may still be prose only in SECRETS.md outside the generated
     markers.
   - `revvault search <token>`
   - `revvault list <prefix>` (for example `revealui/dev/`,
     `revealui/prod/`, `revealui/staging/`)
3. **Hit:** inject. Never print the value.

```bash
revvault run --env STRIPE_SECRET_KEY=revealui/dev/stripe/secret-key -- <cmd>
with-secrets stripe neon -- <cmd>
```

   Local hydrate from a prefix (mirror, not the store):

```bash
revvault export-env revealui/dev/
```

4. **Miss:** stop. Name the vault path the owner should set
   (`revvault set <path>`). Do not open a dashboard. Do not fabricate
   a path. Do not write `.env` by hand.
5. **Provision / signup / "add Neon":** refuse. Point at this skill's
   miss path. The owner creates the account and `revvault set`s the
   path.

Environment is a **namespace**, not a file. `dev` → `revealui/dev/*`.
`staging` → `revealui/staging/*`. `prod` → `revealui/prod/*`. Do not
create `.env.dev` / `.env.production` as a second scheme.

## Do not

- Display secret values. Paths and env key names only.
- Use `$(revvault get …)` in any flag or argv. Stream-safe inject only.
- Hand-edit `.env` / `.env.*` as the source of truth.
- Hand-edit `.projects/` or run Stripe Projects.
- Invent provider names, vault paths, or env keys not found above.
- Put a path table in this skill. Extend `secret-paths.ts` (and its
  lockstep test) when a production-synced path is missing.

## Related

- `revvault/docs/STREAM-SAFE.md` (inject vs vault-private print)
- `revealui/docs/SECRETS.md` + `revealui/scripts/sync/secret-paths.ts`
- `security-hardening` (generic apps; one-line RevFleet pointer)
