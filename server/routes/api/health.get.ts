import { defineEventHandler, setResponseStatus } from "h3";
import { getDbExec } from "../../db/index.js";

export default defineEventHandler(async (event) => {
  try {
    await getDbExec().execute("SELECT 1 AS ready");
    return { ok: true, database: "ready" };
  } catch {
    setResponseStatus(event, 503);
    return { ok: false, database: "unavailable" };
  }
});
