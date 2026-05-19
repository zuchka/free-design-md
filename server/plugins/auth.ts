import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  marketing: {
    appName: "Agent-Native Slides",
    tagline:
      "Your AI agent builds, edits, and refines presentations alongside you.",
    features: [
      "Generate entire decks from a single prompt",
      "Surgical slide edits while you present or review",
      "Real-time collaboration between you and the agent",
    ],
  },
  publicPaths: [
    "/share",
    "/p",
    "/api/share",
    "/_agent-native/google-docs/callback",
    // React Router's lazy route-discovery endpoint must stay public so
    // unauthenticated viewers can open shared presentation links directly.
    "/__manifest",
    // Public C3 surface — type a URL, see screenshot + preview + design.md.
    "/extract",
    // Single public HTTP route: returns text/markdown by default (curl-friendly),
    // or JSON with the full payload (screenshot + tokens + signals) when called
    // with ?format=json. Used by the /extract page. The underlying action stays
    // auth-gated through the framework's owner-context check; this H3 route
    // bypasses it intentionally and is SSRF-guarded by assertSafeUrl.
    "/api/extract",
    // Spike: AI enrichment endpoint on top of the deterministic extract.
    // Accepts the deterministic extract payload, calls Claude Opus 4.7,
    // returns enriched DESIGN.md. No auth on the spike per the plan.
    "/api/enrich-design-md",
  ],
});
