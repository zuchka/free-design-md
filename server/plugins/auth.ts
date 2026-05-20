import { createAuthPlugin } from "@agent-native/core/server";
import type { H3Event } from "h3";
import { getCookie } from "h3";
import {
  SESSION_COOKIE_NAME,
  lookupSession,
} from "../lib/builder-session.js";

/**
 * Bridge the framework's getSession() escape hatch to our SQLite-backed
 * Builder.io session cookie.
 *
 * When set, `AuthOptions.getSession` causes the framework to skip
 * better-auth entirely. Every existing caller of `getSession(event)`
 * (see server/handlers/request-auth-context.ts) keeps working without
 * any changes — they read `{ email, userId }` off the AuthSession
 * shape that this function returns.
 */
async function builderGetSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE_NAME);
  if (!token) return null;
  const session = await lookupSession(token);
  if (!session) return null;
  return {
    email: session.email,
    userId: session.userId,
    name: session.name ?? undefined,
  };
}

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
  getSession: builderGetSession,
  publicPaths: [
    // Product surface stays public — the "Sign in" gate is enforced
    // at the enrich endpoint, not by a route-level redirect.
    "/",
    "/quality",
    "/__manifest",
    "/api/extract",
    // Auth endpoints must be public — they're how users sign in.
    "/api/auth/builder/start",
    "/api/auth/builder/callback",
    "/api/auth/builder/signout",
    "/api/auth/me",
    // Google Docs OAuth callback (unrelated, pre-existing).
    "/_agent-native/google-docs/callback",
    // The enrich endpoint is intentionally NOT in publicPaths — but
    // because our framework auth guard only blocks unauthenticated
    // visits when getSession returns null AND the path isn't here,
    // we need it here too to avoid the framework's marketing page
    // taking over. The real gate happens inside the handler.
    "/api/enrich-design-md",
  ],
});
