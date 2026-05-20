import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  marketing: {
    appName: "Free design.md",
    tagline:
      "Paste any URL — get a portable design.md spec your agents can read.",
    features: [
      "Deterministic extraction of colors, typography, components, and spacing",
      "One-click AI enrichment with Claude Opus 4.7 for brand-voice depth",
      "Drop the design.md into a Builder.io Space and iterate with an agent",
    ],
  },
  publicPaths: [
    // The extractor (and its sibling /quality dashboard) are the product
    // surface. They render without any real auth — the "Sign in" gate is
    // a UX layer inside / that controls the AI-enrichment button, not a
    // route-level redirect. The framework's auth plugin must let these
    // routes through, otherwise it serves its own marketing/sign-in page.
    "/",
    "/quality",
    "/_agent-native/google-docs/callback",
    // React Router's lazy route-discovery endpoint must stay public so
    // the SPA can fetch its route manifest.
    "/__manifest",
    // Curl-friendly extractor endpoint: returns text/markdown by default,
    // or JSON with the full payload (screenshot + tokens + signals) when
    // called with ?format=json. SSRF-guarded by assertSafeUrl.
    "/api/extract",
    // AI enrichment endpoint. The per-user 3-free-enrichments gate is
    // enforced client-side via the mocked auth seam (Phase 2). A real
    // server-side gate ships in Phase 3 alongside Builder.io OAuth.
    "/api/enrich-design-md",
    // Builder OAuth flow — these must be public so unauthenticated users
    // can sign in. The start route issues the redirect; the callback route
    // receives the code and establishes the session.
    "/api/auth/builder/start",
    "/api/auth/builder/callback",
    // Signout is idempotent — must work even if the framework session has
    // already expired or never existed.
    "/api/auth/builder/signout",
    // me returns 401 itself when unauthenticated; the framework must not
    // intercept it first or the client never sees our error shape.
    "/api/auth/me",
  ],
});
