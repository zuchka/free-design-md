import { defineEventHandler, getCookie, deleteCookie } from "h3";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../../../db/index.js";

export default defineEventHandler(async (event) => {
  const token = getCookie(event, "fdmd_session");
  if (token) {
    await getDb()
      .delete(schema.fdmdSessions)
      .where(eq(schema.fdmdSessions.token, token))
      .catch(() => {});
    deleteCookie(event, "fdmd_session", { path: "/" });
  }
  return { ok: true };
});
