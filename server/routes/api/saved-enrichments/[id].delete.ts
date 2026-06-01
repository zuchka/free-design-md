import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from "h3";
import { resolveConnectedBuilderOwner } from "../../../lib/builder-connection.js";
import { resolveOwner } from "../../../lib/owner.js";
import { deleteSavedEnrichmentForOwner } from "../../../lib/saved-enrichments.js";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    setResponseStatus(event, 400);
    return { error: "saved enrichment id is required" };
  }

  const owner = await resolveOwner(event);
  const connected = await resolveConnectedBuilderOwner(owner);
  if (!connected) {
    setResponseStatus(event, 401);
    return { error: "builder_connect_required" };
  }

  const deleted = await deleteSavedEnrichmentForOwner(id, connected.ownerId);
  if (!deleted) {
    setResponseStatus(event, 404);
    return { error: "saved enrichment not found" };
  }

  return { success: true };
});
