import { defineEventHandler, setResponseStatus } from "h3";
import { resolveConnectedBuilderQuotaOwner } from "../../../lib/builder-connection.js";
import { ANONYMOUS_OWNER, resolveOwner } from "../../../lib/owner.js";
import { getCredits } from "../../../lib/quota.js";

export default defineEventHandler(async (event) => {
  const owner = await resolveOwner(event);
  if (owner !== ANONYMOUS_OWNER) {
    return await getCredits(owner);
  }

  const builderOwner = await resolveConnectedBuilderQuotaOwner(owner);
  if (!builderOwner) {
    setResponseStatus(event, 401);
    return { error: "builder_connect_required" };
  }

  return await getCredits(builderOwner);
});
