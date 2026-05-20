import {
  defineEventHandler,
  getRequestURL,
  getQuery,
  setCookie,
  sendRedirect,
} from "h3";
import { randomBytes } from "node:crypto";
import {
  STATE_COOKIE_NAME,
  STATE_MAX_AGE_SECONDS,
} from "../../../../lib/builder-session.js";
import {
  publicOrigin,
  buildCliAuthUrl,
} from "../../../../lib/builder-redirect.js";

/**
 * GET /api/auth/builder/start[?return=<url>]
 *
 * Mints a CSRF state, sets it as an httpOnly cookie, and 302s the user
 * to https://builder.io/cli-auth with our callback as the redirect_url.
 * The optional ?return is the URL the user came from — preserved in a
 * second cookie so the callback can drop them back where they started.
 */
export default defineEventHandler(async (event) => {
  const reqUrl = getRequestURL(event);
  const origin = publicOrigin(reqUrl.origin);

  const state = randomBytes(16).toString("base64url");
  setCookie(event, STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: reqUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  const query = getQuery(event);
  const returnTo = typeof query.return === "string" ? query.return : "/";
  // Validate: only allow same-origin returns to prevent open-redirect.
  let safeReturn = "/";
  try {
    const parsed = new URL(returnTo, origin);
    if (parsed.origin === origin) safeReturn = parsed.pathname + parsed.search;
  } catch {
    // fall through to default
  }
  setCookie(event, "fdmd_oauth_return", safeReturn, {
    httpOnly: true,
    secure: reqUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  const clientId = process.env.BUILDER_CLIENT_ID ?? "free-design-md";
  const target = buildCliAuthUrl({ origin, clientId, state });
  return sendRedirect(event, target, 302);
});
