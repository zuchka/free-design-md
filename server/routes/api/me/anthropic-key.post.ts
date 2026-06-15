import { defineEventHandler, setResponseStatus } from "h3";

/**
 * POST /api/me/anthropic-key
 *
 * Disabled for the hosted product. Free design.md no longer accepts or stores
 * user Anthropic keys on hosted deployments.
 */
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 410);
  return {
    error: "user_keys_not_accepted",
    reason:
      "Hosted Free design.md does not accept Anthropic keys. Use hosted credits or run a local/self-hosted deployment with ANTHROPIC_API_KEY.",
  };
});
