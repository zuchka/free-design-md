import { defineEventHandler, setResponseStatus } from "h3";
import { claimSharePromoCredits } from "../../../lib/quota.js";
import { resolveQuotaOwner } from "../../../lib/quota-owner.js";

export default defineEventHandler(async (event) => {
  const owner = await resolveQuotaOwner(event);
  if (!owner) {
    setResponseStatus(event, 401);
    return { error: "builder_connect_required" };
  }

  return await claimSharePromoCredits(owner);
});
