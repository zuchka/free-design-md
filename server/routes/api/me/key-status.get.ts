import { defineEventHandler } from "h3";
import { getBYOKeyForEvent } from "../../../lib/byo-key.js";

/**
 * GET /api/me/key-status
 * Returns { byoKeyConfigured: boolean } for the current visitor.
 */
export default defineEventHandler(async (event) => {
  const key = await getBYOKeyForEvent(event);
  return { byoKeyConfigured: !!key };
});
