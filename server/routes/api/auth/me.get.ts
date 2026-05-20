import { defineEventHandler, setResponseStatus } from "h3";
import { getSession } from "@agent-native/core/server";
import { quotaRemaining } from "../../../lib/builder-quota.js";

/**
 * GET /api/auth/me
 *
 * Returns the current user payload the client-side auth seam needs:
 * `{ user: { email, name }, remaining }`. 401 if no valid session — the client
 * uses that to fall back to a signed-out snapshot.
 */
export default defineEventHandler(async (event) => {
  const session = await getSession(event).catch(() => null);
  // Match the enrich endpoint: gate on `email`, not `userId`. The legacy
  // `an_session_*` cookie path resolves a session without a `userId`, and
  // quota is keyed off the same principal the enrich endpoint uses.
  if (!session?.email) {
    setResponseStatus(event, 401);
    return { error: "not_authenticated" };
  }
  const remaining = await quotaRemaining(session.email);
  return {
    user: { email: session.email, name: session.name ?? null },
    remaining,
  };
});
