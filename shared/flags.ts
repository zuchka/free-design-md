/**
 * Feature-flag seam. Mocked surfaces (Builder.io SSO, Builder Space
 * integration, the eval dashboard, the demo-brand cache short-circuit)
 * all check a flag here so a real Phase 3 implementation can slot in
 * without touching callsites.
 *
 * Defaults are MOCKED (true) for the hackathon. Flip a surface to "real"
 * by setting its corresponding env var to "1".
 *
 * Flags consumed on the client must use a VITE_ prefix so Vite exposes
 * them to bundled code via import.meta.env. Server-only flags can drop
 * the prefix and use process.env directly.
 */

function readClientEnv(name: string): string | undefined {
  // Vite injects env vars onto import.meta.env at build time.
  // On the server, import.meta is a plain ESM object without `.env`, so
  // we fall back to process.env (mostly for tests + isomorphic callers).
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  if (meta?.env) return meta.env[name];
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}

function readServerEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}

/** True when the mocked Builder.io SSO + localStorage quota are in effect. */
export function useMockedAuth(): boolean {
  return readClientEnv("VITE_FREE_DESIGN_MD_REAL_AUTH") !== "1";
}

/**
 * True when the URL-keyed enrichment cache should short-circuit live LLM
 * calls for known demo brands (stripe, linear, notion). Server-only —
 * checked inside actions/enrich-design-md.ts.
 */
export function useDemoBrandCache(): boolean {
  return readServerEnv("FREE_DESIGN_MD_DISABLE_DEMO_CACHE") !== "1";
}
