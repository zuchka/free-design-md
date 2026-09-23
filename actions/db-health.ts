import { defineAction } from "./define-action.js";
import { getDatabaseUrl } from "../server/db/client.js";
import { getDbExec } from "../server/db/index.js";
import { z } from "zod";

export default defineAction({
  description: "Check database health and connection status.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const isLocal = (): boolean => {
      const hostname = new URL(getDatabaseUrl()).hostname;
      return hostname === "localhost" || hostname === "127.0.0.1";
    };

    try {
      const exec = getDbExec();
      await exec.execute("SELECT 1");
      return { ok: true, local: isLocal() };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Unknown",
      };
    }
  },
});
