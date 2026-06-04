import { defineEventHandler, setResponseStatus } from "h3";
import { resolveAgentContextOwner } from "../../../lib/owner.js";
import { resolveConnectedBuilderOwner } from "../../../lib/builder-connection.js";
import { listSavedEnrichmentsForOwner } from "../../../lib/saved-enrichments.js";

export default defineEventHandler(async (event) => {
  const owner = await resolveAgentContextOwner(event);
  const connected = await resolveConnectedBuilderOwner(owner);

  if (!connected) {
    setResponseStatus(event, 401);
    return { error: "builder_connect_required" };
  }

  return {
    items: await listSavedEnrichmentsForOwner(connected.ownerId),
  };
});
