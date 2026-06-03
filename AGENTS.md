# free-design-md — Dev & Agent Guide

A free, agent-native tool that turns any URL into a portable `design.md` spec.

Paste a URL → headless Chromium loads the page → we extract colors, typography, components, spacing, and radii → render a `design.md` (Google Stitch / VoltAgent schema). Optional one-click **Enrich with AI** sends the deterministic output + a screenshot to Claude Sonnet 4.6 and gets back a richer, brand-voice-aware version.

The product surface is one URL: `/`. The agent surface is `pnpm action <name>`. This file is symlinked as `CLAUDE.md` — both names point at the same content.

## Why this is agent-native

Three concrete claims (not vibes):

1. **Every UI capability is a callable action.** The `/` page hits `GET /api/extract` and `POST /api/enrich-design-md`. Both endpoints are thin wrappers over actions in `actions/`. An external agent (Claude Code, Codex, Cursor, a Builder.io Space agent, anything that can run a shell or speak A2A) calls the same `extract-design-md` and `enrich-design-md` code paths via `pnpm action <name>`. No UI-only logic.

2. **The output `design.md` is the agent-native artifact.** It's not a screenshot, not a JSON blob, not a vendor-locked file format — it's a portable Markdown + YAML spec following the Google Stitch / VoltAgent schema. Downstream agents read it natively and iterate on it ("tighten the spacing scale", "make the primary more energetic"). The design.md is the moat.

3. **We kept the load-bearing framework primitives.** `@agent-native/core` runtime, `defineAction()`, `appBasePath()`, the auth plugin, the A2A agent card (`server/agent-card.test.ts` asserts it advertises the right skills). Discoverability + invocation + authorization are the parts of agent-native that earn their complexity; we kept them.

The app now ships an agent chat sidebar via `<AgentSidebar>` in `app/root.tsx`. The direct extract → enrich path remains the primary one-shot workflow, and the sidebar is used for follow-up iteration on an already-loaded design.md.

## For external agents

You can call this app's surface from any environment that runs a shell or speaks A2A.

**Programmatic extraction:**

```bash
pnpm action extract-design-md --url stripe.com
```

Returns JSON on stdout with the design.md text, the underlying `designSystemData` token tree, signals (title, description, computed CSS samples), and a base64 data-URL screenshot.

**Programmatic enrichment** (requires `ANTHROPIC_API_KEY`):

```bash
pnpm action enrich-design-md \
  --url stripe.com \
  --designSystemData '<json from extract>' \
  --signals '<json from extract>' \
  --screenshotDataUrl '<data url from extract>' \
  --deterministicMarkdown '<md from extract>'
```

Returns the AI-enriched design.md plus latency and token usage.

**A2A discovery:** the agent card is served by the framework; see `server/agent-card.test.ts` for the canonical skill list (currently `extract-design-md`, `enrich-design-md`, `iterate-design-md`, `export-design-md`).

## Actions reference

| Action               | Args                                                                                                                   | Purpose                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `extract-design-md`  | `--url <url>`                                                                                                          | Headless visit + computed-CSS extraction → `{ url, markdown, designSystemData, signals, screenshotDataUrl }`. Deterministic; no LLM. |
| `enrich-design-md`   | `--url <url> --designSystemData '<json>' --signals '<json>' --screenshotDataUrl <data-url> --deterministicMarkdown '<md>'` | Sends the deterministic extraction + screenshot to Claude Sonnet 4.6. Returns a richer design.md plus usage and latency. Requires `ANTHROPIC_API_KEY` unless `anthropicApiKey` is passed by an HTTP wrapper. |
| `iterate-design-md`  | `--previousMarkdown '<md>' --userPrompt '<text>' [--sectionTarget <slug>]` | One-shot revision of an AI-enriched design.md per a user instruction. User input is treated as untrusted data — wrapped in nonce-delimited tags, run through a blocklist, and the output is shape-validated before return. The action itself does not touch quota; the HTTP route decrements quota when it uses the server key. Requires `ANTHROPIC_API_KEY` unless `anthropicApiKey` is passed by an HTTP wrapper. |
| `export-design-md`   | `--id <designSystemId>`                                                                                                | Re-render a stored design system as design.md.                                                         |
| `db-health` / `db-status` / `db-connect` | —                                                                                          | Framework DB health checks (kept for diagnostics).                                                     |

Use `pnpm action <name> [args]` to invoke any of them. Output is JSON on stdout.

## API routes

| Method | Path                                  | What it does                                                          |
| ------ | ------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/extract?url=<url>&format=json`  | Thin wrapper over `extract-design-md`. Public.                        |
| POST   | `/api/enrich-design-md`               | SSE wrapper over `enrich-design-md`. Resolves Anthropic key via `server/lib/anthropic-key.ts`: BYO key is preferred and does not spend quota; the server key uses Builder credit access. Free/unknown Builder accounts spend finite quota, paid/Enterprise Builder accounts are unlimited. Anonymous server-key calls require Builder Connect credentials, because Builder Connect does not create an app session. |
| POST   | `/api/iterate-design-md`              | SSE wrapper over `iterate-design-md`. Uses the same Anthropic key and Builder credit-access behavior. Returns 402 when no key is available or finite credits are exhausted, 422 on blocklist hit, 400 on input-cap violation. |
| GET    | `/api/me/credits`                     | Returns finite `{ allowed, remaining, unlimited: false, accountTier, planLabel, builderOrgName }` or unlimited `{ allowed: null, remaining: null, unlimited: true, accountTier, planLabel, builderOrgName }`; returns 401 for anonymous visitors without Builder Connect. Used by the UI to render the credits chip. |
| POST   | `/api/me/anthropic-key`               | Stores the user's BYO Anthropic API key against their `fdmd_anon` session token. Body: `{ apiKey: string }`. Returns 400 if key doesn't start with "sk-". |
| GET    | `/api/me/key-status`                  | Returns `{ byoKeyConfigured: boolean }` for the current visitor. Used by the UI to decide whether a BYO key is already stored. |

## Dev

Dev server runs on port **8080** (not 5173).

```bash
nvm use
pnpm install
pnpm dev           # http://localhost:8080
pnpm typecheck     # agent-native typecheck — silent on success
pnpm test          # vitest (currently 144 tests)
pnpm action <name> # invoke any action from the CLI
```

Env vars (`.env.local`):

- `DATABASE_URL` — auto-loaded by the framework
- `ANTHROPIC_API_KEY` — server fallback key for enrich/iterate. If absent, visitors need a stored BYO Anthropic key.

Slide-related secrets, ports, and config from the original slides template are gone — the only LLM the app talks to directly is Anthropic, for enrichment and iteration.

## Identity, Keys, and Credits

There is no first-party Builder SSO implementation in this app right now. The stale `/api/auth/builder/start`, `/api/auth/builder/callback`, `fdmd_users`, and `fdmd_sessions` flow described in older docs is not the current product path.

The current model is:

- **Anonymous visitor identity:** `server/plugins/anon-session.ts` sets an `fdmd_anon` cookie for every browser. This is only a stable browser token for BYO key storage.
- **BYO Anthropic key:** `POST /api/me/anthropic-key` stores a visitor's key in `fdmd_byo_keys`, keyed by `fdmd_anon`. BYO keys always win and do not spend credits.
- **Server Anthropic key:** when no BYO key exists, `server/lib/anthropic-key.ts` falls back to `process.env.ANTHROPIC_API_KEY`. Server-key calls go through `server/lib/credit-access.ts`: free/unknown Builder accounts spend credits from `fdmd_quota`; paid and Enterprise Builder accounts do not decrement quota.
- **Builder Connect:** `BuilderConnectCta` uses `useBuilderConnectFlow()` and the framework route `/_agent-native/builder/connect`. This is not app login. It stores Builder credential material in the framework's request-scoped credential store.
- **Builder callback data:** the framework callback currently receives `p-key`, `api-key`, `user-id`, `org-name`, `kind`, `subscription`, `subscription-level`, `subscription-name`, `is-enterprise`, and `is-free-account`. The app only uses the resolved credential metadata exposed by `resolveBuilderCredentials()`; it must never log key values.
- **Builder entitlements:** `shared/builder-entitlements.ts` classifies Builder metadata into `free`, `paid`, `enterprise`, or `unknown`. Only explicit paid/Enterprise metadata grants unlimited app-hosted AI credits; missing/unknown metadata stays on finite credits.
- **Quota owner:** anonymous server-key AI calls are allowed only after Builder Connect resolves a complete Builder credential bundle. In that path, `server/lib/builder-connection.ts` returns `builder:<userId>` when `userId` exists; finite credits are keyed to that owner.
- **Credits:** `fdmd_quota` stores `enrich_count` and `bonus_credits`. New rows default to `DEFAULT_ALLOWED_CREDITS = 3` in `server/lib/quota.ts`.

## Current Follow-Up Work

- Streaming with larger `max_tokens` and prompt caching are still productization work.
- URL-keyed result caching exists in `enrichment_cache`; keep using it for demos and repeated enrichments.
- Eval harness work against VoltAgent references is still deferred.
- The chat sidebar can iterate on loaded design.md context, but agent tool-call results still do not automatically update the left pane preview.
