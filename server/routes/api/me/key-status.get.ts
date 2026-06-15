import { defineEventHandler, setResponseStatus } from "h3";

/**
 * GET /api/me/key-status
 *
 * Disabled for the hosted product. Retained only to return a clear response
 * for older clients that still probe the former BYO-key flow.
 */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 410);
  return {
    error: "user_keys_not_accepted",
    reason:
      "Hosted Free design.md does not accept Anthropic keys. Use hosted credits or run a local/self-hosted deployment with ANTHROPIC_API_KEY.",
  };
});
