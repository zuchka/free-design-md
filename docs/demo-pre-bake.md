# Hackathon demo — cache pre-bake

The AI enrichment for any URL takes 30-60s when it hits Claude live. For a
3-4 minute show-and-tell that's a long beat. The fix: pre-bake the
`enrichment_cache` table once before the demo so the three demo brands
return instantly.

## Pre-bake

Set `ANTHROPIC_API_KEY` in `.env.local`, then:

```bash
pnpm tsx scripts/prebake-demo-brands.ts
```

The script extracts and enriches `stripe.com`, `linear.app`, and
`notion.so` in sequence. Wall time is ~3-5 minutes; cost at Opus 4.7
rates is ~$3-5 total (less after the first call thanks to prompt
caching on the ~40 KB VoltAgent reference).

The script is idempotent — re-running overwrites the same rows. If one
brand fails (network, rate limit), the others still land.

## During the demo

Paste any of `stripe.com`, `linear.app`, `notion.so` and click Extract,
then Enrich. The AI-enriched pane fills in immediately — no spinner,
no delay. The full token-usage strip still shows real numbers from
the original baked call.

To prove the live path still works (e.g. for a Q&A), use any URL not
in the cache (`coca-cola.com`, `airbnb.com`, etc.). Those go to Claude
live and stream in over 30-60s.

## Forcing a live call on a cached brand

If you need to demo the streaming UX on a brand the cache already
holds, set `FREE_DESIGN_MD_DISABLE_DEMO_CACHE=1` in `.env.local` and
restart the dev server. The lookup short-circuit turns off; everything
hits Claude live.

## Bumping the cache

The cache key is `${url}::${promptVersion}`. `promptVersion` is the
`PROMPT_VERSION` constant in `actions/enrich-prompt.ts`. Bump it when
you change the prompt structure; every row invalidates naturally and
you'll want to re-run the pre-bake.
