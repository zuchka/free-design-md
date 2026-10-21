# free-design-md

Paste any public URL and get a portable `design.md` specification. The deterministic extraction is free. AI enrichment and follow-up revisions use AI runs purchased as one-time packs through Stripe.

## Get started

- [Use the website](https://freedesign.md) for free extraction and optional hosted AI enrichment.
- [Install the standalone skill](#standalone-agent-skill) to extract inside Claude Code or Codex and optionally enrich with your agent’s own model.

The HTTP API, catalog CLI, repository actions, and self-hosting are advanced options.

## Product model

- Deterministic extraction uses Playwright and computed CSS. It does not require an account or an LLM.
- AI enrichment sends the deterministic artifact and screenshot to Claude Sonnet 4.6.
- One AI enrichment or revision costs one AI run.
- AI runs cost $0.89 for one or $4.99 for 10; runs do not expire.
- AI runs are sold as one-time purchases through Stripe Checkout. There is no signup grant or subscription.
- Email magic links provide account recovery and attach purchases to a stable identity.
- Self-hosted mode uses the deployment's `ANTHROPIC_API_KEY` without metering.

Public `/d/:id` snapshots created before the billing change remain readable. Legacy Builder identities and free-credit balances are intentionally not migrated.

## Stack

- React Router 7 Framework Mode + Vite
- Drizzle ORM + Supabase Postgres
- Better Auth (anonymous sessions and email magic links)
- Stripe Checkout + signed webhooks
- H3 for the existing API handler adapter while routes move to native React Router resources
- Playwright for extraction and Anthropic's SDK for AI enrichment

There is no Agent Native runtime, Builder Connect flow, A2A card, or embedded agent chat.

## Production releases

`main` is the canonical production branch, including the Supabase Postgres
runtime, Stripe fulfillment, billing metrics, and demo previews. Target feature
PRs at `main`; the former migration branch is historical.

Application tests, Postgres integration tests, typechecking, and the production
build run on PRs. See [production deployment](docs/production-deployment.md)
for release and verification steps. A published Docker image alone is not proof
that the website has been updated.

## Local development

```bash
nvm use
pnpm install
pnpm db:start
pnpm db:reset
cp .env.example .env.local
pnpm dev
```

The development server runs at [http://localhost:8080](http://localhost:8080).
Schema changes are versioned in `supabase/migrations/`; application startup
never runs DDL. Docker is required for the local Supabase database.

Useful commands:

```bash
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
pnpm db:test
pnpm demo:reset
pnpm demo:verify
pnpm action extract-design-md --url stripe.com
```

For extraction failure causes, recovery counters, and troubleshooting, see
[Extraction diagnostics](docs/extraction-diagnostics.md). `/api/extraction-health`
provides an aggregate health summary alongside the Prometheus `/api/metrics` endpoint.

See [`docs/sqlite-to-supabase-runbook.md`](docs/sqlite-to-supabase-runbook.md)
for snapshot, import, deterministic verification, deployment, and rollback.
`pnpm demo:reset` rebuilds the local Supabase database, creates a sanitized
production-shaped SQLite fixture, imports it, and prints the migration
scoreboard. Interview delivery notes and the production safety gates live in
[`docs/interview-demo-script.md`](docs/interview-demo-script.md) and
[`docs/production-cutover-checklist.md`](docs/production-cutover-checklist.md).

## Stripe setup

Create one-time Stripe Prices for a single $0.89 AI run and a $4.99 pack of 10, then configure:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_1_CREDIT=price_...
STRIPE_PRICE_10_CREDITS=price_...
```

Send these webhook events to `/api/billing/webhook`:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Fulfillment is idempotent by Stripe event and Checkout Session. The server determines the pack size; client-supplied credit quantities are ignored.

For local Stripe testing:

```bash
stripe listen --forward-to localhost:8080/api/billing/webhook
```

## Email sign-in

Better Auth uses anonymous sessions automatically. Before checkout, users link an email via a magic link. Production email delivery uses Resend:

```bash
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=https://your-domain.example
RESEND_API_KEY=re_...
AUTH_EMAIL_FROM="Free design.md <noreply@your-domain.example>"
```

In development, magic links are printed to the server console when `RESEND_API_KEY` is unset.

## Optional: self-host the full application

The standalone skill needs no Docker, database, or app server. Use Docker when
hosting the complete website and HTTP API yourself. The Dockerfile is also used
for our production deployment.

Prepare a dedicated PostgreSQL database and apply `supabase/migrations/*.sql`
in filename order before startup. Supabase provides the `anon` and `authenticated`
roles; create those roles first when using plain PostgreSQL. Set `DATABASE_URL`
to that database, using a TLS-enabled connection for a remote host. A runtime
login needs membership in the `free_design_app` role created by the migrations.

```bash
# First set DATABASE_URL to a PostgreSQL database with the app migrations applied.
# Generate this secret once and reuse it across restarts.
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
export PUBLIC_ORIGIN="http://localhost:3000"
export BETTER_AUTH_URL="$PUBLIC_ORIGIN"

# Optional: set ANTHROPIC_API_KEY for self-hosted AI enrichment.
docker pull ghcr.io/zuchka/free-design-md:latest
docker run --rm \
  -p 127.0.0.1:3000:3000 \
  -e FREE_DESIGN_MD_SELF_HOSTED=1 \
  -e DATABASE_URL \
  -e BETTER_AUTH_SECRET \
  -e BETTER_AUTH_URL \
  -e PUBLIC_ORIGIN \
  -e ANTHROPIC_API_KEY \
  ghcr.io/zuchka/free-design-md:latest
```

Keep `BETTER_AUTH_SECRET` stable across restarts. For a public deployment, set
`PUBLIC_ORIGIN` and `BETTER_AUTH_URL` to its public URL and configure network
access. The example binds the app to localhost. Deterministic extraction needs
no Anthropic key; self-hosted AI requires `ANTHROPIC_API_KEY` and does not spend
hosted AI runs. Stripe and email configuration are unnecessary for self-hosted
extraction and AI enrichment.

## Repository CLI actions

These commands require a cloned repository, Node.js 22.12, pnpm dependencies,
and Playwright Chromium. See [local development](#local-development) for setup.
They share the website’s extraction and AI modules. Use `--silent` to keep pnpm’s
banner out of JSON output:

```bash
pnpm --silent action extract-design-md --url stripe.com > extract.json
pnpm --silent action iterate-design-md \
  --previousMarkdown '<design.md>' \
  --userPrompt 'Tighten the spacing scale'
```

CLI AI actions read `ANTHROPIC_API_KEY` from the environment. Action output is JSON on stdout.

## Standalone agent skill

[`skills/extract-design-md`](skills/extract-design-md/SKILL.md) is a self-contained
skill for extracting a public website's design inside a coding agent. It saves
`design.md`, raw signals and tokens in `extraction.json`, and a screenshot when
available. Optional enrichment uses the agent's own model. The skill needs no
app server, account, database, Anthropic key, or hosted credits.

Install from a checkout with the Skills CLI:

```bash
npx skills add . --skill extract-design-md --global
```

Install directly from GitHub without cloning this repository:

```bash
npx skills add zuchka/free-design-md --skill extract-design-md --global
```

Alternatively, copy the entire `skills/extract-design-md` directory into your
agent's skills directory. Node.js 22.12+ and npm are required. The skill's setup
instructions install its pinned dependencies and Playwright Chromium on first
use. Then ask the agent to extract a URL, optionally requesting enrichment.

To run it directly from this checkout:

```bash
npm ci --prefix skills/extract-design-md
npm --prefix skills/extract-design-md run install-browser
node skills/extract-design-md/scripts/extract.mjs \
  --url https://example.com \
  --output ./design-extractions/example-com
```

Use a new output directory for each extraction. The command prints one JSON
summary with artifact paths and diagnostics. The app and the skill share the
extraction implementation in the skill's `scripts/lib/` directory; the app adds
its own metrics around that implementation.

## API summary

| Method | Path                                 | Purpose                                        |
| ------ | ------------------------------------ | ---------------------------------------------- |
| `GET`  | `/api/extract?url=<url>&format=json` | Public deterministic extraction                |
| `POST` | `/api/enrich-design-md`              | Stream AI enrichment; spends one hosted credit |
| `POST` | `/api/iterate-design-md`             | Stream a revision; spends one hosted credit    |
| `GET`  | `/api/me/credits`                    | Read the signed-in user's wallet               |
| `POST` | `/api/billing/checkout`              | Create a Stripe Checkout Session               |
| `POST` | `/api/billing/webhook`               | Fulfill paid Checkout Sessions                 |
| `GET`  | `/api/saved-enrichments/:id`         | Read a public saved artifact                   |

The `free-design-md` npm package browses and downloads curated artifacts:

```bash
npx free-design-md list
npx free-design-md add stripe --out specs/stripe.design.md
```

Its source and catalog live in [`zuchka/free-design-md-catalog`](https://github.com/zuchka/free-design-md-catalog).
For a fresh URL extraction, use the skill, HTTP API, or repository actions.

## Monitoring

`GET /api/metrics` exposes Prometheus metrics for extraction, AI outcomes, fulfilled
credit packs, and wallet reservations, commits, and refunds. Set
`PROMETHEUS_METRICS_TOKEN` to protect the endpoint. See [the metrics guide](docs/prometheus.md)
for metric names, example queries, and replica deduplication requirements.
