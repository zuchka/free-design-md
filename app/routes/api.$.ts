import type { Route } from "./+types/api.$";
import { apiApp } from "../../server/api-app.js";
import { migrationWritePauseResponse } from "../../server/lib/migration-maintenance.js";

export function loader({ request }: Route.LoaderArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return apiApp.fetch(request);
}

export function action({ request }: Route.ActionArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return apiApp.fetch(request);
}
