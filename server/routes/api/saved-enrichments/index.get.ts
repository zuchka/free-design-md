import { defineEventHandler, setResponseStatus } from "h3";
import { resolveVerifiedOwner } from "../../../lib/owner.js";
import { listSavedEnrichmentsForOwner } from "../../../lib/saved-enrichments.js";

export default defineEventHandler(async (event) => {
  const ownerId = await resolveVerifiedOwner(event);
  if (!ownerId) {
    setResponseStatus(event, 401);
    return { error: "sign_in_required" };
  }

  return {
    items: await listSavedEnrichmentsForOwner(ownerId),
  };
});
