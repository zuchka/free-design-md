/**
 * True when the URL-keyed enrichment cache should short-circuit live LLM
 * calls for known demo brands (stripe, linear, notion). Server-only —
 * checked inside actions/enrich-design-md.ts.
 */
export function useDemoBrandCache(): boolean {
  if (typeof process === "undefined" || !process.env) return true;
  return process.env.FREE_DESIGN_MD_DISABLE_DEMO_CACHE !== "1";
}
