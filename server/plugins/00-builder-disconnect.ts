import {
  defineNitroPlugin,
  deleteBuilderCredentials,
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
 * free-design.md uses Builder Connect without first-party app login. Core's
 * disconnect route requires an authenticated app session, so anonymous MVP
 * visitors hit 401 even though their Builder credentials are stored under the
 * app's anonymous owner bucket. Register this exact route before core-routes.
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

      await deleteBuilderCredentials(ANONYMOUS_OWNER);
      return { ok: true };
    }),
  );
});
