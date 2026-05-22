import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { getMySession } from "../../../lib/session.js";
import { applyBuilderKeyBonus } from "../../../lib/builder-quota.js";

const REASON_MESSAGES: Record<string, string> = {
  invalid_key:
    "That API key doesn't match any active Builder.io space. Find your public API key in your space settings.",
  key_already_used:
    "This API key has already been used to unlock credits on another account.",
  already_unlocked: "You've already unlocked bonus credits on this account.",
  verification_failed:
    "Couldn't reach Builder.io to verify the key — try again in a moment.",
};

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Content-Type", "application/json");

  const session = await getMySession(event);
  if (!session) {
    setResponseStatus(event, 401);
    return { error: "Sign in to unlock credits" };
  }

  const body = await readBody<Record<string, unknown>>(event).catch(
    () => ({}) as Record<string, unknown>,
  );
  const apiKey =
    typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

  if (!apiKey) {
    setResponseStatus(event, 400);
    return { error: "apiKey is required" };
  }

  // Light sanity check — the CDN call is the authoritative validator
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(apiKey)) {
    setResponseStatus(event, 400);
    return {
      error:
        "That doesn't look like a valid Builder.io public API key. It should be a short alphanumeric string from your space settings.",
    };
  }

  const result = await applyBuilderKeyBonus(session.email, apiKey);

  if (!result.ok) {
    setResponseStatus(event, 422);
    return {
      error:
        REASON_MESSAGES[result.reason ?? ""] ?? "Verification failed — try again.",
    };
  }

  return { ok: true, remaining: result.remaining };
});
