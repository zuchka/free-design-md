# free-design-md

Paste any public URL and get a portable `design.md` specification. The deterministic extraction is free. AI enrichment and follow-up revisions use AI runs purchased as one-time packs through Stripe.

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
- Drizzle ORM + libSQL/SQLite
- Better Auth (anonymous sessions and email magic links)
- Stripe Checkout + signed webhooks
- H3 for the existing API handler adapter while routes move to native React Router resources
- Playwright for extraction and Anthropic's SDK for AI enrichment

There is no Agent Native runtime, Builder Connect flow, A2A card, or embedded agent chat.

## Local development

```bash
nvm use
pnpm install
cp .env.example .env.local
pnpm dev
```

The development server runs at [http://localhost:8080](http://localhost:8080). Database migrations run automatically before development and production startup.

Useful commands:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm migrate
pnpm action extract-design-md --url stripe.com
```

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

## Self-hosting

```bash
docker pull ghcr.io/zuchka/free-design-md:latest

docker run --rm \
  -p 3000:3000 \
  -e FREE_DESIGN_MD_SELF_HOSTED=1 \
  -e ANTHROPIC_API_KEY \
  -e DATABASE_URL=file:./data/app.db \
  -v free-design-md-data:/app/data \
  ghcr.io/zuchka/free-design-md:latest
```

Self-hosted AI calls are unmetered and do not require Stripe or email configuration.

## CLI actions

The browser and CLI share the same extraction and AI modules:

```bash
pnpm action extract-design-md --url stripe.com
pnpm action iterate-design-md \
  --previousMarkdown '<design.md>' \
  --userPrompt 'Tighten the spacing scale'
```

CLI AI actions read `ANTHROPIC_API_KEY` from the environment. Action output is JSON on stdout.

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

The public CLI and curated catalog live in [`zuchka/free-design-md-catalog`](https://github.com/zuchka/free-design-md-catalog).
