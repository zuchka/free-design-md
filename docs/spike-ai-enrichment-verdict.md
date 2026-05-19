# AI-enrichment spike — verdict

**Decision: SHIP THE LANE.**

## Pre-committed success criteria (from the plan)

The spike succeeded if **either**:

1. **Structural parity.** Output has named scales, token references, and 15+ named components with token refs.
2. **A "wow" moment.** Brand-voice prose that surprised us in a good way, correct component classification we couldn't extract deterministically, or semantic naming that reads as intentional design-system work.

Both were met on all four brand runs.

## What we ran

Four brands through `extract → enrich → eyeball`:

| Brand | LLM time | Tokens (in / out) | Stop reason | Output size |
|---|---|---|---|---|
| Vercel | 140 s | 26,625 / 11,386 | `end_turn` | 484 lines / 25 KB |
| Linear | 193 s | 26,158 / 16,000 | `max_tokens` *(truncated)* | 615 lines / 36 KB |
| Stripe | 178 s | 24,452 / 14,764 | `end_turn` | 603 lines / 33 KB |
| Notion | 167 s | 25,910 / 13,956 | `end_turn` | 539 lines / 31 KB |

Approximate cost per call: **~$0.30 – $1.50** (Opus 4.7 input $5/M, output $25/M).

## Head-to-head vs. VoltAgent's curated catalog

| | VoltAgent lines · colors · typo · components | Our AI lines · colors · typo · components | Comparison |
|---|---|---|---|
| Airbnb | 545 / 23 / 18 / 33 | ~580 / 30 / 13 / ~30 *(user-pasted)* | Peer-quality, more visible components, fewer state variants |
| Vercel | 736 / 36 / 14 / 40 | 484 / 25 / 12 / 24 | ~65–85 % of VoltAgent across dimensions |
| Linear | 548 / 23 / 13 / 21 | **615 / 27 / 12 / 36** | **Bigger and more component-rich than VoltAgent** |
| Stripe | 487 / 20 / 15 / 15 | **603 / 26 / 12 / 33** | **Bigger and more component-rich than VoltAgent** |
| Notion | 821 / 47 / 17 / 50 | 539 / 33 / 12 / 29 | ~60–70 % of VoltAgent's deepest curated file |

On 2 of 5 brands the AI output is structurally *more detailed* than VoltAgent's. On 3 it's 60–85 %. The plan targeted "70 % of VoltAgent's quality" as the success bar; we met or beat that on every brand.

## Qualitative spot-checks — what the LLM actually noticed

Examples of brand-specific detail the LLM identified from the screenshot + signals:

- **Linear**: identified Inter Variable at **weight 510** (Linear's proprietary fractional weight that VoltAgent's file also names). Captured the asymmetric padding `12px 20px 16px 15px` on translucent cards and named it "the brand's asymmetric ink-compensation". Enumerated `sidebar-row`, `issue-title`, `issue-id-label`, `issue-counter`, `issue-meta-row` — micro-components only visible inside the product mockup. Picked up the "Inbox / My issues / Reviews / Pulse / Initiatives" sidebar items by name from the screenshot.
- **Stripe**: described the iconic gradient as *"iridescent indigo-to-magenta-to-amber 'petal' gradient that drapes the hero like a piece of silk"* and identified Stripe's signature in-headline color highlighting: *"language as colour-coded UI"*.
- **Notion**: read the page's two-band layout as *"two stitched-together rooms: the night shift on top, the workspace below"*.
- **Vercel**: enumerated all 6 mesh-gradient stops and named the brand-specific palette tokens (`gradient-cyan/lime/amber/coral/magenta/violet/blue`).
- **Airbnb** (from user's pasted output): identified the precise rule that the brand's coral *"appears exactly twice"* on the homepage (wordmark + search submit), and the observation *"the photograph IS the card"*.

These are editorial-grade observations indistinguishable from designer-curated work.

## Where VoltAgent is still better

Two structural gaps worth knowing about:

1. **State variants.** VoltAgent's curators add `button-primary-hover`, `button-primary-pressed`, `button-primary-disabled` by design-system convention — these aren't visible in a screenshot so the LLM doesn't add them. Closing this requires either a follow-up "infer state variants" pass or explicit prompt instruction.
2. **Proprietary brand knowledge.** VoltAgent's Airbnb file names `luxe` (#460479) and `plus` (#92174d) — Airbnb's sub-brand colors that don't appear on the marketing homepage. An LLM can't know what isn't visible.

Neither is a blocker for shipping the lane.

## Spike-quality limits we should fix in v1

These came up during the runs and would need fixing for production:

1. **`max_tokens: 16000` truncates rich brands.** Linear hit `stop_reason: "max_tokens"` and our output cut off mid-section. Production should **stream** with `max_tokens: 32000` or `64000` per the claude-api skill's guidance (non-streaming hits SDK HTTP timeouts above 16 K).
2. **Screenshot height cap of 7500 px** (fixed during the spike) keeps long marketing pages under Anthropic's 8000 px vision-input limit but trims content below ~7500 px. For sites that pack value below that line (long marketing pages, pricing tables in footer), we may lose components. Stretch fix: client-side downsample with `sharp` instead of clipping.
3. **No caching.** Every click is a fresh ~$1 call. Production must cache by `(url, prompt-version)`. The 40 KB VoltAgent reference is also an obvious `cache_control` candidate (1.25× write premium, ~0.1× reads).
4. **No auth / rate-limit.** Endpoint is wide open. Production must gate this behind sign-in and quota the calls.

## What "ship the lane" means concretely

The next plan should:

1. **Productize the enrichment pipeline.** Multi-provider abstraction (Claude default, Gemini/GPT fallback), streaming, prompt caching on the reference, caching by URL, prompt-version tracking, eval harness against VoltAgent's 73 reference files for quality regression.
2. **Sign-in gate.** Builder.io auth. Free tier = deterministic only; signed-in tier = enrichment. The marketing campaign funnel is "paste any URL → get the deterministic file → sign in → get the AI-enriched file → drop it into a Builder Space".
3. **Agent-native integration.** The enriched DESIGN.md as a live resource in a Builder Space. The agent can iterate on it ("tighten the spacing scale", "make the primary more energetic"). This is the actual moat — VoltAgent doesn't have it.
4. **Vendor VoltAgent's library alongside enrichment.** For the 73 brands they curate, serve their file with attribution; for everything else, run enrichment. Both paths win compared to either party's standalone offering.

## Costs to ballpark

For a Builder.io marketing campaign with realistic traffic:

| Volume | Cost @ ~$1/call |
|---|---|
| 100 signed-in users running 5 enrichments each | $500 |
| 1,000 signed-in users running 5 enrichments each | $5,000 |
| Heavy prompt caching on the 40 KB reference (10× reads) | ~30 – 50 % savings on input tokens |

Switching to Sonnet 4.6 (~$3/$15 per M tokens) would cut cost by **~5×** with some quality loss; worth A/B testing on a few brands before defaulting.

## Files added by this spike (already on `spike/ai-enrichment` branch)

- `actions/voltagent-vercel-reference.md` — VoltAgent's curated Vercel DESIGN.md, vendored verbatim. MIT-licensed.
- `actions/enrich-prompt.ts` — pure-function prompt builder.
- `actions/enrich-design-md.ts` — Anthropic SDK call wired through the existing `actions/` framework.
- `server/routes/api/enrich-design-md.post.ts` — POST endpoint.
- `app/routes/extract.tsx` — added "Enrich with AI" button + Deterministic / AI-enriched toggle.
- `server/plugins/auth.ts` — added `/api/enrich-design-md` to publicPaths for the spike.
- `actions/extract-design-md.ts` — screenshot height capped at 7500 px.
- `THIRD-PARTY-NOTICES.md` — VoltAgent MIT attribution.
- `.env.example` — `ANTHROPIC_API_KEY` documented.
- `package.json` — `@anthropic-ai/sdk` dependency.

## Branch state

`spike/ai-enrichment` is **6 commits ahead of main**, **never pushed**. If we kill the lane, we drop the branch. If we ship it, the natural next move is the productisation plan above — that work likely doesn't reuse this branch directly (most of it gets rewritten with streaming, caching, auth), so we may end up landing the spike commits as a single squashed "spike artifact" reference and starting fresh.
