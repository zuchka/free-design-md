/**
 * SSR entry point for Nitro.
 * Wraps React Router's request handler so Nitro can use it as a service.
 */
import { createRequestHandler } from "react-router";
import { migrationWritePauseResponse } from "./server/lib/migration-maintenance.js";

const handler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
);

export default {
  async fetch(request: Request) {
    const maintenanceResponse = migrationWritePauseResponse(request);
    if (maintenanceResponse) return maintenanceResponse;
    return handler(request);
  },
};
