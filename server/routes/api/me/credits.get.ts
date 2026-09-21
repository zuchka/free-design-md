import { defineEventHandler, setResponseStatus } from "h3";
import { getCredits } from "../../../lib/quota.js";
import { resolveVerifiedOwner } from "../../../lib/owner.js";

export default defineEventHandler(async (event) => {
  const owner = await resolveVerifiedOwner(event);
  if (!owner) {
    setResponseStatus(event, 401);
    return { error: "sign_in_required", allowed: 0, remaining: 0 };
  }

  return await getCredits(owner);
});
