import {
  analyticsSession,
  recordGrowthEvent,
} from "../../server/lib/analytics.js";
import {
  resolveAnalyticsActor,
  visitorCookie,
  trackingAllowed,
} from "../../server/lib/analytics-identity.js";
import type { Route } from "./+types/api.auth.$";
import { auth } from "../../server/lib/auth.js";
import { migrationWritePauseResponse } from "../../server/lib/migration-maintenance.js";

export function loader({ request }: Route.LoaderArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return auth.handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  const response = await auth.handler(request);
  const path = new URL(request.url).pathname;
  if (response.ok && path.endsWith("/sign-out")) {
    response.headers.append(
      "Set-Cookie",
      visitorCookie("", new URL(request.url).protocol === "https:", 0),
    );
  }
  if (
    response.ok &&
    path.endsWith("/sign-in/magic-link") &&
    trackingAllowed(request.headers)
  ) {
    const session = await analyticsSession(request);
    const actor = await resolveAnalyticsActor(request, session?.user);
    await recordGrowthEvent(
      { name: "sign_in_requested", key: `sign-in:${crypto.randomUUID()}` },
      actor,
    );
  }
  return response;
}
