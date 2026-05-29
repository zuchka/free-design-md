# free-design-md — Dev & Agent Guide

A free, agent-native tool that turns any URL into a portable `design.md` spec.

Paste a URL → headless Chromium loads the page → we extract colors, typography, components, spacing, and radii → render a `design.md` (Google Stitch / VoltAgent schema). Optional one-click **Enrich with AI** sends the deterministic output + a screenshot to Claude Opus 4.7 and gets back a richer, brand-voice-aware version.

The product surface is one URL: `/`. The agent surface is `pnpm action <name>`. This file is symlinked as `CLAUDE.md` — both names point at the same content.

## Why this is agent-native

Three concrete claims (not vibes):

1. **Every UI capability is a callable action.** The `/` page hits `GET /api/extract` and `POST /api/enrich-design-md`. Both endpoints are thin wrappers over actions in `actions/`. An external agent (Claude Code, Codex, Cursor, a Builder.io Space agent, anything that can run a shell or speak A2A) calls the same `extract-design-md` and `enrich-design-md` code paths via `pnpm action <name>`. No UI-only logic.

2. **The output `design.md` is the agent-native artifact.** It's not a screenshot, not a JSON blob, not a vendor-locked file format — it's a portable Markdown + YAML spec following the Google Stitch / VoltAgent schema. Downstream agents read it natively and iterate on it ("tighten the spacing scale", "make the primary more energetic"). The design.md is the moat.

3. **We kept the load-bearing framework primitives.** `@agent-native/core` runtime, `defineAction()`, `appBasePath()`, the auth plugin, the A2A agent card (`server/agent-card.test.ts` asserts it advertises the right skills). Discoverability + invocation + authorization are the parts of agent-native that earn their complexity; we kept them.

What we deliberately did **not** do: ship a chat sidebar. The extract → enrich pipeline is a one-shot structured transformation. A chat sidebar adds tool-loop overhead, message persistence, and multi-turn scaffolding for nothing here. The direct Anthropic SDK call inside `actions/enrich-design-md.ts` is measurably faster end-to-end with the same API key + model than the equivalent chat-sidebar path would be.

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

**A2A discovery:** the agent card is served by the framework; see `server/agent-card.test.ts` for the canonical skill list (currently `extract-design-md`, `enrich-design-md`, `export-design-md`).

## Actions reference

| Action               | Args                                                                                                                   | Purpose                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `extract-design-md`  | `--url <url>`                                                                                                          | Headless visit + computed-CSS extraction → `{ url, markdown, designSystemData, signals, screenshotDataUrl }`. Deterministic; no LLM. |
| `enrich-design-md`   | `--url <url> --designSystemData '<json>' --signals '<json>' --screenshotDataUrl <data-url> --deterministicMarkdown '<md>'` | Sends the deterministic extraction + screenshot to Claude Opus 4.7. Returns a richer design.md plus usage and latency. Requires `ANTHROPIC_API_KEY`. |
| `iterate-design-md`  | `--previousMarkdown '<md>' --userPrompt '<text>' [--sectionTarget <slug>]` | One-shot revision of an AI-enriched design.md per a user instruction. User input is treated as untrusted data — wrapped in nonce-delimited tags, run through a blocklist, and the output is shape-validated before return. Consumes 1 credit from `fdmd_quota`. Requires `ANTHROPIC_API_KEY`. |
| `export-design-md`   | `--id <designSystemId>`                                                                                                | Re-render a stored design system as design.md.                                                         |
| `db-health` / `db-status` / `db-connect` | —                                                                                          | Framework DB health checks (kept for diagnostics).                                                     |

Use `pnpm action <name> [args]` to invoke any of them. Output is JSON on stdout.

## API routes

| Method | Path                                  | What it does                                                          |
| ------ | ------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/extract?url=<url>&format=json`  | Thin wrapper over `extract-design-md`. Public.                        |
| POST   | `/api/enrich-design-md`               | Thin wrapper over `enrich-design-md`. Public at the route level; UI gates the button behind Builder Connect (`useBuilderConnectFlow().configured`). |
| POST   | `/api/iterate-design-md`              | SSE wrapper over `iterate-design-md`. Decrements `fdmd_quota` for the resolved owner (the framework's `anonymousOwner` — `anonymous@free-design-md.local` for this single-tenant app). Returns 402 when out of credits, 422 on blocklist hit (no credit charged), 400 on input-cap violations. UI gates the panel on Builder Connect. |
| GET    | `/api/me/credits`                     | Returns `{ allowed, remaining }` for the resolved owner. Used by the UI to render the "X credits left" counter on the iteration panel. |

## Dev

Dev server runs on port **8080** (not 5173).

```bash
pnpm install
pnpm dev           # http://localhost:8080
pnpm typecheck     # agent-native typecheck — silent on success
pnpm test          # vitest (currently 144 tests)
pnpm action <name> # invoke any action from the CLI
```

Env vars (`.env.local`):

- `DATABASE_URL` — auto-loaded by the framework
- `ANTHROPIC_API_KEY` — required for the `Enrich with AI` button (and `enrich-design-md` action)

Slide-related secrets, ports, and config from the original slides template are gone — the only LLM the app talks to is Anthropic, and only for enrichment.

## Auth — Builder.io SSO via `/cli-auth`

`free-design-md` uses Builder.io's existing `/cli-auth` partner redirect
flow to sign users in. There is no OAuth 2.0 endpoint on builder.io — auth
is Firebase under the hood — so we lean on the same redirect-with-BPK flow
that the Builder CLI and Figma plugin use.

**Client seam** (`app/lib/auth/`): contract is fixed across mock + real.
Set `VITE_FREE_DESIGN_MD_REAL_AUTH=1` to switch the seam to the real impl.

**Server flow:**

1. User clicks "Sign in with Builder.io" → `GET /api/auth/builder/start` sets
   a state cookie and 302s to `https://builder.io/cli-auth` with
   `redirect_url=…/api/auth/builder/callback?state=<nonce>` and attribution
   params (`signupSource=agent-native`, `agentNativeFlow=design_extraction`).
2. Builder forwards unauthenticated users to `/login` or `/signup`
   (preserving our attribution params), then back to `/cli-auth`.
3. User clicks Authorize. Builder redirects to our callback with
   `?p-key=bpk-…&user-id=…&api-key=…`.
4. Callback validates the state cookie, calls
   `GET https://builder.io/api/v1/users/<user-id>?apiKey=…` with the BPK
   as a bearer token. On 200, identity is verified.
5. We upsert into `fdmd_users`, seed `fdmd_quota` (default 3), mint an
   opaque token, store in `fdmd_sessions`, set `fdmd_session` cookie,
   discard the BPK, and 302 back to the original page.
6. The framework's `AuthOptions.getSession` is wired to read our cookie,
   so `getSession(event)` in any handler returns
   `{ email, userId, name }` for the Builder-verified user.

**Production prerequisite:** the deployed hostname must be in
`isAllowedRedirectUrl()` at
`~/code/builder-internal/packages/app/components/CLIAuthPage.tsx:28`.
Today: `localhost`, `*.agent-native.com`, `*.builder.io`. Either deploy
under one of those, or land a one-line PR adding the prod host.

**Env vars:** `PUBLIC_ORIGIN` (required in prod), `BUILDER_CLIENT_ID`
(defaults to `free-design-md`), `VITE_FREE_DESIGN_MD_REAL_AUTH=1` to
flip the client seam to the real impl.

## Phase 2 (deferred, not in this codebase yet)

The spike verdict at `docs/spike-ai-enrichment-verdict.md` lays out the productization roadmap:

- Builder.io SSO sign-in gate (anonymous = deterministic only; signed-in = enrichment unlocked)
- 3-free-enrichments quota per signed-in user
- Streaming with `max_tokens: 32-64K` (current spike caps at 16K and truncates rich brands)
- Prompt caching on the 40 KB VoltAgent reference (significant input-token savings)
- URL-keyed result cache
- Multi-provider abstraction (Claude default, Gemini/GPT fallback for cost A/B)
- Eval harness vs. VoltAgent's 73 reference files
- `design.md` as a live agent-iterable resource inside a Builder.io Space

Phase 2 is the much larger push. This codebase is the clean base it lands on.
