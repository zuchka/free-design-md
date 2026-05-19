/**
 * Feature-flag seam. Mocked surfaces (Builder.io SSO, Builder Space
 * integration, the eval dashboard, the demo-brand cache short-circuit)
 * all check a flag here so a real Phase 3 implementation can slot in
 * without touching callsites.
 *
 * Defaults are MOCKED (true) for the hackathon. Flip a surface to "real"
 * by setting its corresponding env var to "1".
 *
 * IMPORTANT — `import.meta.env` access rules:
 *
 * Vite's module runner statically replaces literal property accesses on
 * `import.meta.env` at load time. **Dynamic indexing** (`env[name]`) or
 * any helper-mediated indirection is forbidden and throws "Dynamic
 * access of import.meta.env is not supported".
 *
 * Therefore each predicate inlines the literal property access
 * (`import.meta.env.VITE_FREE_DESIGN_MD_REAL_AUTH`). The optional chain
 * on `?.env` handles Node-only contexts (e.g. `pnpm tsx
 * scripts/prebake-demo-brands.ts`) where Vite doesn't intercept the
 * module and `import.meta.env` is undefined.
 *
 * Each predicate also falls back to `process.env.<NAME>` so the same
 * value can be set via a plain shell env var when running outside Vite.
 */

/** True when the mocked Builder.io SSO + localStorage quota are in effect. */
export function useMockedAuth(): boolean {
  const fromVite = import.meta.env?.VITE_FREE_DESIGN_MD_REAL_AUTH;
  const fromProcess =
    typeof process !== "undefined" && process.env
      ? process.env.VITE_FREE_DESIGN_MD_REAL_AUTH
      : undefined;
  return (fromVite ?? fromProcess) !== "1";
}

/**
 * True when the URL-keyed enrichment cache should short-circuit live LLM
 * calls for known demo brands (stripe, linear, notion). Server-only —
 * checked inside actions/enrich-design-md.ts. No `VITE_` prefix because
 * the client never reads this; we only need the process.env path.
 */
export function useDemoBrandCache(): boolean {
  if (typeof process === "undefined" || !process.env) return true;
  return process.env.FREE_DESIGN_MD_DISABLE_DEMO_CACHE !== "1";
}
