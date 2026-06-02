import {
  defineNitroPlugin,
  deleteBuilderCredentials,
  getSession,
  getH3App,
} from "@agent-native/core/server";
import {
  defineEventHandler,
  getHeader,
  getMethod,
  getRequestURL,
  setResponseStatus,
} from "h3";
import { ANONYMOUS_OWNER } from "../lib/owner.js";

/**
 * free-design.md uses Builder Connect without first-party app login in prod,
 * but local dev can still have the framework's dev session. Core's disconnect
 * route only clears authenticated app-session credentials, so anonymous MVP
 * visitors hit 401. Register this exact route before core-routes and clear the
 * active session bucket when present, plus the anonymous bucket as fallback.
 */
export default defineNitroPlugin((nitroApp) => {
  getH3App(nitroApp).use(
    "/_agent-native/builder/disconnect",
    defineEventHandler(async (event) => {
      if (getMethod(event) !== "POST") {
        setResponseStatus(event, 405);
        return { error: "Method not allowed" };
      }

      const origin = getHeader(event, "origin");
      const requestUrl = getRequestURL(event);
      if (origin && origin !== requestUrl.origin) {
        setResponseStatus(event, 403);
        return { error: "forbidden" };
      }

      const session = await getSession(event).catch(() => null);
      const owners = new Set([ANONYMOUS_OWNER]);
      if (session?.email) owners.add(session.email);

      await Promise.all([...owners].map((owner) => deleteBuilderCredentials(owner)));
      return { ok: true };
    }),
  );
});
