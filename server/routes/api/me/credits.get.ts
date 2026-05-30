import { defineEventHandler } from "h3";
import { resolveOwner } from "../../../lib/owner.js";
import { getCredits } from "../../../lib/quota.js";

export default defineEventHandler(async (event) => {
  const owner = await resolveOwner(event);
  return await getCredits(owner);
});
