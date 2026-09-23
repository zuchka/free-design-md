# free-design-md — development guide

Free design.md turns a public URL into a portable `design.md` specification. The deterministic extraction is free; Claude enrichment and follow-up revisions cost one purchased credit each.

## Architecture

- React Router 7 Framework Mode is the application and SSR runtime.
- React Router resource routes own Better Auth and Stripe endpoints.
- Existing extraction/enrichment handlers are mounted through `server/api-app.ts` using H3. Keep new endpoints as React Router resource routes unless they need the streaming adapter.
- Drizzle + Postgres live in `server/db/`; application tables are in the private `app` schema.
- Versioned Supabase migrations live in `supabase/migrations/`. Runtime startup never runs DDL.
- Reusable CLI operations live in `actions/` and use the local `defineAction()` helper.

Do not add Agent Native, Builder Connect, an A2A card, embedded agent chat, or Builder-based entitlements. Those systems were intentionally removed.

## Product rules

1. Deterministic URL extraction is public and free.
2. Hosted AI enrichment and iteration require a verified email account and one wallet credit.
3. Credits are bought as a one-time pack of 10 through Stripe Checkout.
4. Credit quantity is resolved from the server-side pack catalog, never request metadata.
5. Stripe fulfillment must remain idempotent by event and Checkout Session.
6. Reserve a credit before an AI stream, commit it on success, and refund it on failure.
7. Self-hosted mode (`FREE_DESIGN_MD_SELF_HOSTED=1`) uses `ANTHROPIC_API_KEY` without billing.
8. Hosted routes never accept a user-supplied Anthropic key.
9. Existing public `/d/:id` snapshots must remain readable.
10. Legacy Builder identities and free quotas are not migrated.

## Identity and billing

- Better Auth tables: `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`.
- Better Auth plugins: anonymous session + magic-link email.
- Anonymous data is transferred to the verified account in `server/lib/auth.ts` when accounts are linked.
- Wallet tables: `credit_wallets`, `credit_ledger`, `credit_operations`.
- Billing tables: `purchases`, `stripe_events`.
- Stripe pack catalog: `server/lib/stripe.ts`.
- Billing resource routes: `app/routes/api.billing.*`.

Required hosted environment variables:

```text
ANTHROPIC_API_KEY
BETTER_AUTH_SECRET
BETTER_AUTH_URL
PUBLIC_ORIGIN
RESEND_API_KEY
AUTH_EMAIL_FROM
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_10_CREDITS
DATABASE_URL
DATABASE_POOL_SIZE (optional; defaults to 5)
```

## Actions

```bash
pnpm action extract-design-md --url stripe.com
pnpm action enrich-design-md --url ... --designSystemData '{...}' --signals '{...}' --screenshotDataUrl 'data:...' --deterministicMarkdown '...'
pnpm action iterate-design-md --previousMarkdown '...' --userPrompt '...'
pnpm action db-health
```

Action output is JSON on stdout. AI actions read `ANTHROPIC_API_KEY` from the local environment and do not spend hosted credits.

## Development

```bash
nvm use
pnpm install
pnpm db:start
pnpm db:reset
pnpm dev           # http://localhost:8080
pnpm typecheck
pnpm test
pnpm test:db
pnpm db:test
pnpm build
```

Playwright Chromium must be installed for extraction tests:

```bash
pnpm exec playwright install chromium
```

## Important files

- `app/routes/_index.tsx` — extraction/enrichment workspace
- `app/routes/d.$id.tsx` — durable public artifact route
- `app/components/PurchaseCreditsButton.tsx` — email-link and purchase UI
- `server/lib/auth.ts` — Better Auth configuration and anonymous account linking
- `server/lib/quota.ts` — wallet, ledger, reservation, commit/refund, purchase grant
- `server/lib/stripe.ts` — server-side credit pack catalog
- `supabase/migrations/` — canonical Postgres schema
- `scripts/migrate-sqlite-to-postgres.ts` — one-time transactional data import
- `scripts/verify-postgres-migration.ts` — deterministic post-import verification
- `server/api-app.ts` — temporary H3 adapter for existing API handlers

## Security invariants

- Never trust client-provided credit counts, owner IDs, prices, or payment status.
- Verify Stripe signatures against the raw body before fulfillment.
- Scope purchases, wallets, saved-library listing, and deletion by Better Auth user ID.
- Keep public snapshot reads intentionally public.
- Keep extraction SSRF protections intact.
- Never log API keys, auth tokens, magic-link tokens, or Stripe secrets.
