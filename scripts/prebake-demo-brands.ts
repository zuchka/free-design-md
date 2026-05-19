/**
 * Pre-bake the AI-enrichment cache for the three hackathon-demo brands.
 *
 * Run once before a demo session:
 *
 *   pnpm tsx scripts/prebake-demo-brands.ts
 *
 * Requires ANTHROPIC_API_KEY in .env.local. Costs roughly $1-2 per
 * brand at Opus 4.7 rates; total ~3-5 minutes wall time. Each
 * successful enrichment writes to the `enrichment_cache` table, so
 * subsequent demo runs hit the cache and return instantly.
 *
 * Idempotent: re-running just overwrites the existing rows (the
 * enrichmentCache table uses `onConflictDoUpdate` on insert).
 */
import "dotenv/config";
import extractAction from "../actions/extract-design-md.js";
import enrichAction from "../actions/enrich-design-md.js";

const BRANDS = ["stripe.com", "linear.app", "notion.so"];

async function prebake(url: string): Promise<void> {
  console.log(`\n=== ${url} ===`);
  console.log("  1/2 Extracting deterministic signals (Playwright)…");
  const extraction = await extractAction.run({ url });
  if (!extraction.screenshotDataUrl) {
    throw new Error(`No screenshot returned for ${url}; cannot enrich`);
  }
  console.log("  2/2 Enriching with Claude Opus 4.7 (30-60s)…");
  const startedAt = Date.now();
  const enriched = await enrichAction.run({
    url: extraction.url,
    designSystemData: extraction.designSystemData,
    signals: extraction.signals,
    screenshotDataUrl: extraction.screenshotDataUrl,
    deterministicMarkdown: extraction.markdown,
  });
  const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
  console.log(
    `  ✓ Cached in ${elapsed}s · ` +
      `${enriched.usage.inputTokens.toLocaleString()} in / ` +
      `${enriched.usage.outputTokens.toLocaleString()} out · ` +
      `cache reads ${enriched.usage.cacheReadInputTokens.toLocaleString()}`,
  );
}

let failed = 0;
for (const brand of BRANDS) {
  try {
    await prebake(brand);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${brand} failed:`, err instanceof Error ? err.message : err);
  }
}

console.log(
  `\nPre-bake complete: ${BRANDS.length - failed}/${BRANDS.length} brands cached.`,
);
process.exit(failed > 0 ? 1 : 0);
