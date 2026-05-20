import {
  defineEventHandler,
  getQuery,
  getCookie,
  setCookie,
  deleteCookie,
  sendRedirect,
  createError,
} from "h3";
import {
  STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/builder-session.js";
import { handleCallback } from "../../../../lib/builder-verify.js";

/**
 * GET /api/auth/builder/callback?state=…&p-key=bpk-…&user-id=…&api-key=…
 *
 * 1. Validate the state cookie matches the ?state query param.
 * 2. Call /api/v1/users/:id with the BPK to verify the identity.
 * 3. Upsert the user, seed quota, mint a session token, set cookie.
 * 4. Discard the BPK. Redirect back to fdmd_oauth_return (or /).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const state = typeof query.state === "string" ? query.state : "";
  const userId = typeof query["user-id"] === "string" ? query["user-id"] : "";
  const apiKey = typeof query["api-key"] === "string" ? query["api-key"] : "";
  const privateKey =
    typeof query["p-key"] === "string" ? query["p-key"] : "";

  const cookieState = getCookie(event, STATE_COOKIE_NAME);
  deleteCookie(event, STATE_COOKIE_NAME);

  if (!state || !cookieState || state !== cookieState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or expired sign-in state",
    });
  }

  if (!userId || !apiKey || !privateKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing identity parameters from Builder.io",
    });
  }

  const result = await handleCallback({ userId, apiKey, privateKey });
  if (!result.ok) {
    throw createError({
      statusCode: 401,
      statusMessage: "Could not verify your Builder.io identity",
    });
  }

  setCookie(event, SESSION_COOKIE_NAME, result.sessionToken, {
    httpOnly: true,
    secure: event.node.req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const returnTo = getCookie(event, "fdmd_oauth_return") ?? "/";
  deleteCookie(event, "fdmd_oauth_return");
  return sendRedirect(event, returnTo, 302);
});
