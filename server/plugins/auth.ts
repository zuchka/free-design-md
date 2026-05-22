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
    // Railway health check — must be public or the deploy never becomes healthy.
    "/api/health",
    // Product surface stays public — the "Sign in" gate is enforced
    // at the enrich endpoint, not by a route-level redirect.
    "/",
    "/quality",
    "/__manifest",
    "/api/extract",
    // /api/auth/me returns 401 itself for unauthenticated users; the
    // framework must not intercept it first or the client never sees the JSON.
    "/api/auth/me",
    // /api/auth/unlock-with-builder-key handles its own 401 for unauthenticated
    // requests; the framework must not intercept it first.
    "/api/auth/unlock-with-builder-key",
    // Google Docs OAuth callback (unrelated, pre-existing).
    "/_agent-native/google-docs/callback",
    // The enrich endpoint gates auth inside the handler (returns 401/402 JSON).
    // Keep public so the framework doesn't serve the marketing page instead.
    "/api/enrich-design-md",
    // Builder.io CLI-auth flow — must be public so unauthenticated users
    // reach start/callback without being intercepted by the auth guard.
    "/api/auth/builder/start",
    "/api/auth/builder/callback",
    // Sign-out clears the session; public so the guard doesn't reject the POST.
    "/api/auth/sign-out",
  ],
});
