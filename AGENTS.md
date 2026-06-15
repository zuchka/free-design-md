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

**Programmatic enrichment** (requires `ANTHROPIC_API_KEY` in the local environment):

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

| Action                                   | Args                                                                                                                       | Purpose                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract-design-md`                      | `--url <url>`                                                                                                              | Headless visit + computed-CSS extraction → `{ url, markdown, designSystemData, signals, screenshotDataUrl }`. Deterministic; no LLM.                                                                                                                                                                                                                                   |
| `enrich-design-md`                       | `--url <url> --designSystemData '<json>' --signals '<json>' --screenshotDataUrl <data-url> --deterministicMarkdown '<md>'` | Sends the deterministic extraction + screenshot to Claude Sonnet 4.6. Returns a richer design.md plus usage and latency. The action reads `ANTHROPIC_API_KEY` from the local environment and does not accept request/body key arguments.                                                                                                                               |
| `iterate-design-md`                      | `--previousMarkdown '<md>' --userPrompt '<text>' [--sectionTarget <slug>]`                                                 | One-shot revision of an AI-enriched design.md per a user instruction. User input is treated as untrusted data — wrapped in nonce-delimited tags, run through a blocklist, and the output is shape-validated before return. The action reads `ANTHROPIC_API_KEY` from the local environment and does not touch quota; hosted HTTP routes apply quota before calling it. |
| `export-design-md`                       | `--id <designSystemId>`                                                                                                    | Re-render a stored design system as design.md.                                                                                                                                                                                                                                                                                                                         |
| `db-health` / `db-status` / `db-connect` | —                                                                                                                          | Framework DB health checks (kept for diagnostics).                                                                                                                                                                                                                                                                                                                     |

Use `pnpm action <name> [args]` to invoke any of them. Output is JSON on stdout.

## API routes

| Method | Path                                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/extract?url=<url>&format=json` | Thin wrapper over `extract-design-md`. Public.                                                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/api/enrich-design-md`              | SSE wrapper over `enrich-design-md`. Hosted mode uses the deployment's server key and spends quota; self-host mode (`FREE_DESIGN_MD_SELF_HOSTED=1`) uses `ANTHROPIC_API_KEY` from the deployment environment without Builder Connect or quota. User-supplied request keys are rejected. Anonymous hosted server-key calls require Builder Connect credentials, because Builder Connect does not create an app session. |
| POST   | `/api/iterate-design-md`             | SSE wrapper over `iterate-design-md`. Uses the same hosted/self-hosted Anthropic key resolution and quota behavior. Returns 402 when no hosted key is available or credits are exhausted, 503 when self-host mode lacks `ANTHROPIC_API_KEY`, 422 on blocklist hit, and 400 on input-cap violation.                                                                                                                     |
| GET    | `/api/me/credits`                    | Returns `{ allowed, remaining }` for authenticated or Builder-connected quota owners; returns 401 for anonymous visitors without Builder Connect. Used by the UI to render the credits chip.                                                                                                                                                                                                                           |
| POST   | `/api/me/anthropic-key`              | Legacy compatibility endpoint for the removed hosted BYO-key flow. Returns 410 and does not store keys.                                                                                                                                                                                                                                                                                                                |
| GET    | `/api/me/key-status`                 | Legacy compatibility endpoint for the removed hosted BYO-key flow. Returns 410 and does not report stored keys.                                                                                                                                                                                                                                                                                                        |

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
- `ANTHROPIC_API_KEY` — server key for hosted enrich/iterate, and local key for self-host mode. Hosted calls spend quota; self-host calls do not.
- `FREE_DESIGN_MD_SELF_HOSTED=1` — explicit local/private deployment mode. AI routes use `ANTHROPIC_API_KEY` without Builder Connect or hosted quota and return a setup error if it is missing.

Public Docker run through GitHub Container Registry:

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

Slide-related secrets, ports, and config from the original slides template are gone — the only LLM the app talks to directly is Anthropic, for enrichment and iteration.

## Identity, Keys, and Credits

There is no first-party Builder SSO implementation in this app right now. The stale `/api/auth/builder/start`, `/api/auth/builder/callback`, `fdmd_users`, and `fdmd_sessions` flow described in older docs is not the current product path.

The current model is:

- **Anonymous visitor identity:** `server/plugins/anon-session.ts` sets an `fdmd_anon` cookie for every browser. This is a stable browser token for hosted quota ownership and Builder Connect lookup.
- **Hosted Anthropic keys:** hosted Free design.md never accepts user Anthropic keys. AI routes reject `x-anthropic-api-key` and JSON `anthropicApiKey`.
- **Legacy BYO storage:** `fdmd_byo_keys`, `/api/me/anthropic-key`, and `/api/me/key-status` remain only for compatibility/no destructive migration. Do not use them in active hosted product flows.
- **Server Anthropic key:** `server/lib/anthropic-key.ts` reads `process.env.ANTHROPIC_API_KEY`. Hosted server-key calls spend credits from `fdmd_quota`.
- **Self-host mode:** when `FREE_DESIGN_MD_SELF_HOSTED=1`, the same `ANTHROPIC_API_KEY` environment key is used without Builder Connect or hosted quota.
- **Builder Connect:** `BuilderConnectCta` uses `useBuilderConnectFlow()` and the framework route `/_agent-native/builder/connect`. This is not app login. It stores Builder credential material in the framework's request-scoped credential store.
- **Builder callback data:** the framework callback currently receives `p-key`, `api-key`, `user-id`, `org-name`, and `kind`. The app only uses the resolved credential metadata exposed by `resolveBuilderCredentials()`: `userId`, `orgName`, and `orgKind`; it must never log key values.
- **Quota owner:** anonymous server-key enrich calls are allowed only after Builder Connect resolves a complete Builder credential bundle. In that path, `server/lib/builder-connection.ts` returns `builder:<userId>` when `userId` exists; otherwise it falls back to the anonymous owner.
- **Credits:** `fdmd_quota` stores `enrich_count` and `bonus_credits`. New rows default to `DEFAULT_ALLOWED_CREDITS = 3` in `server/lib/quota.ts`.

Important consequence: Builder Connect does not currently prove an app user session or expose a billing plan like free/pro. For credit decisions by Builder account level, first inspect real `orgKind`/`orgName`/`userId` values from the sanitized connect logs, then add an explicit Builder account lookup if the callback metadata is insufficient.

## Current Follow-Up Work

- Decide whether credit grants should be based on Builder Connect metadata (`orgKind`) or a separate Builder API/account lookup.
- Streaming with larger `max_tokens` and prompt caching are still productization work.
- URL-keyed result caching exists in `enrichment_cache`; keep using it for demos and repeated enrichments.
- Eval harness work against VoltAgent references is still deferred.
- The chat sidebar can iterate on loaded design.md context, but agent tool-call results still do not automatically update the left pane preview.
