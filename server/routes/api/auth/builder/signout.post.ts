import { defineEventHandler, getCookie, deleteCookie } from "h3";
import {
  SESSION_COOKIE_NAME,
  deleteSession,
} from "../../../../lib/builder-session.js";

/**
 * POST /api/auth/builder/signout
 *
 * Deletes the server-side session row and clears the cookie. Idempotent —
 * calling without a cookie or with an unknown token still 200s.
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE_NAME);
  if (token) {
    await deleteSession(token);
  }
  deleteCookie(event, SESSION_COOKIE_NAME, { path: "/" });
  return { ok: true };
});
