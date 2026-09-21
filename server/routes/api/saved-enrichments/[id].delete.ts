import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from "h3";
import { resolveVerifiedOwner } from "../../../lib/owner.js";
import { deleteSavedEnrichmentForOwner } from "../../../lib/saved-enrichments.js";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    setResponseStatus(event, 400);
    return { error: "saved enrichment id is required" };
  }

  const ownerId = await resolveVerifiedOwner(event);
  if (!ownerId) {
    setResponseStatus(event, 401);
    return { error: "sign_in_required" };
  }

  const deleted = await deleteSavedEnrichmentForOwner(id, ownerId);
  if (!deleted) {
    setResponseStatus(event, 404);
    return { error: "saved enrichment not found" };
  }

  return { success: true };
});
