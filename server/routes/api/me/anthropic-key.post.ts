import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { setBYOKeyForEvent } from "../../../lib/byo-key.js";

/**
 * POST /api/me/anthropic-key
 * Body: { apiKey: string }
 * Stores the user's BYO Anthropic key against their fdmd_anon session token.
 * Returns 400 if the key doesn't start with "sk-".
 * Returns 409 if the visitor has no fdmd_anon cookie (cookie middleware should prevent this).
 */
export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { apiKey?: string } | null;
  if (!body || typeof body.apiKey !== "string" || !body.apiKey.startsWith("sk-")) {
    setResponseStatus(event, 400);
    return { error: "bad_key" };
  }
  await setBYOKeyForEvent(event, body.apiKey);
  return { ok: true };
});
