import { defineEventHandler, setResponseStatus } from "h3";
import { getMySession } from "../../../lib/session.js";
import { quotaStatus } from "../../../lib/builder-quota.js";

export default defineEventHandler(async (event) => {
  const session = await getMySession(event);
  if (!session) {
    setResponseStatus(event, 401);
    return { error: "not_authenticated" };
  }
  const { remaining, hasBuilderSpace } = await quotaStatus(session.email);
  return {
    user: { email: session.email, name: session.name ?? null },
    remaining,
    hasBuilderSpace,
  };
});
