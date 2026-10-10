import type { Route } from "./+types/api.$";
import { withGrowthRequest } from "../../server/lib/analytics.js";
import { apiApp } from "../../server/api-app.js";
import { migrationWritePauseResponse } from "../../server/lib/migration-maintenance.js";

export function loader({ request }: Route.LoaderArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return /\/(extract|enrich-design-md|iterate-design-md|design-artifact-event|saved-enrichments)/.test(
    new URL(request.url).pathname,
  )
    ? withGrowthRequest(request, () => apiApp.fetch(request))
    : apiApp.fetch(request);
}

export function action({ request }: Route.ActionArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return /\/(extract|enrich-design-md|iterate-design-md|design-artifact-event|saved-enrichments)/.test(
    new URL(request.url).pathname,
  )
    ? withGrowthRequest(request, () => apiApp.fetch(request))
    : apiApp.fetch(request);
}
