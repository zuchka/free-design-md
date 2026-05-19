# free-design-md

Paste any URL. Get a portable `design.md` spec. Optionally enrich it with Claude Opus 4.7.

![paste a URL → get a design.md](./public/icon-180.svg)

## What it is

A headless-Chromium pipeline that extracts a design system from any live page:

- **Deterministic pass** — Playwright opens the page in a real browser, samples computed CSS for colors, typography, buttons, cards, headings, links, the spacing histogram, and corner radii, and renders a `design.md` following the Google Stitch / VoltAgent schema.
- **AI-enriched pass** *(one click)* — the deterministic output plus a full-page screenshot is sent to Claude Opus 4.7, which returns a richer, brand-voice-aware `design.md` with semantic naming, design-token references, and editorial-grade component notes.

No sign-in is required for the deterministic pass. The AI-enriched pass needs an `ANTHROPIC_API_KEY` in `.env.local` today, and will move behind Builder.io SSO + a per-user quota in Phase 2.

## How to run

```bash
pnpm install
pnpm dev     # opens at http://localhost:8080
```

Then visit [http://localhost:8080](http://localhost:8080), paste a URL (e.g. `stripe.com`), and click **Extract**.

To run the same extraction from a shell or another agent:

```bash
pnpm action extract-design-md --url stripe.com
```

`pnpm action enrich-design-md` takes the deterministic JSON output and produces the AI-enriched markdown.

## Why this is agent-native

Three load-bearing properties, not vibes:

1. **Every UI capability is a callable action.** The browser hits `GET /api/extract` and `POST /api/enrich-design-md`. Both routes are thin wrappers around actions in [`actions/`](./actions). Any external agent (Claude Code, Codex, Cursor, a Builder.io Space agent, anything that runs a shell or speaks A2A) calls the same code paths via `pnpm action <name>`. There is no UI-only logic.

2. **The output `design.md` is the agent-native artifact.** It's a portable Markdown + YAML spec — not a JSON blob, not a vendor-locked file format. Downstream agents read it natively and iterate on it ("tighten the spacing scale", "make the primary more energetic"). The artifact is the moat.

3. **We kept the load-bearing framework primitives:** `@agent-native/core` runtime, `defineAction()`, `appBasePath()`, the auth plugin, and the A2A agent card. Discovery + invocation + authorization are the parts of agent-native that earn their complexity; they all still work.

We deliberately did **not** ship a chat sidebar. Extract → enrich is a one-shot structured transformation; the chat-sidebar tool-loop is overhead for nothing here. The direct Anthropic SDK call inside [`actions/enrich-design-md.ts`](./actions/enrich-design-md.ts) is measurably faster end-to-end with the same key + model. Agent-native ≠ "must show a chat UI."

## Roadmap

The spike that proved out the enrichment lane is documented in [`docs/spike-ai-enrichment-verdict.md`](./docs/spike-ai-enrichment-verdict.md), including head-to-head quality comparisons against VoltAgent's curated catalog on five brands (Airbnb, Vercel, Linear, Stripe, Notion).

Phase 2 (next push) productizes the lane:

- Builder.io SSO sign-in gate; anonymous users get the deterministic pass, signed-in users unlock AI enrichment
- 3-free-enrichments quota per signed-in user
- Streaming with `max_tokens: 32-64K` (current spike caps at 16K and truncates rich brands like Linear)
- Prompt caching on the 40 KB VoltAgent reference
- URL-keyed result cache by `(url, prompt-version)`
- Multi-provider abstraction (Claude default; Gemini/GPT fallback for cost A/B)
- Eval harness vs. VoltAgent's 73 reference files for regression
- `design.md` as a live agent-iterable resource inside a Builder.io Space — the actual moat

## More

Dev and agent-facing details live in [`AGENTS.md`](./AGENTS.md) (also accessible as `CLAUDE.md` via a symlink). Spike background and decision data live in [`docs/spike-ai-enrichment-verdict.md`](./docs/spike-ai-enrichment-verdict.md).
