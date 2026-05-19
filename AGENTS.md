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
| `export-design-md`   | `--id <designSystemId>`                                                                                                | Re-render a stored design system as design.md.                                                         |
| `db-health` / `db-status` / `db-connect` | —                                                                                          | Framework DB health checks (kept for diagnostics).                                                     |

Use `pnpm action <name> [args]` to invoke any of them. Output is JSON on stdout.

## API routes

| Method | Path                                  | What it does                                                          |
| ------ | ------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/extract?url=<url>&format=json`  | Thin wrapper over `extract-design-md`. Public.                        |
| POST   | `/api/enrich-design-md`               | Thin wrapper over `enrich-design-md`. Public (only gated by `ANTHROPIC_API_KEY` being set). Phase 2 will add Builder SSO + per-user quota. |

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
