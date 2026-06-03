import { defineEventHandler, setResponseStatus } from "h3";
import {
  getCreditStatus,
  resolveCreditAccount,
} from "../../../lib/credit-access.js";
import { ANONYMOUS_OWNER, resolveOwner } from "../../../lib/owner.js";

export default defineEventHandler(async (event) => {
  const owner = await resolveOwner(event);
  const creditAccount = await resolveCreditAccount(owner);
  if (owner === ANONYMOUS_OWNER && !creditAccount.builderOwner) {
    setResponseStatus(event, 401);
    return { error: "builder_connect_required" };
  }

  return await getCreditStatus(creditAccount);
});
