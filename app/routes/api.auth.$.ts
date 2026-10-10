import type { Route } from "./+types/api.auth.$";
import { auth } from "../../server/lib/auth.js";
import { migrationWritePauseResponse } from "../../server/lib/migration-maintenance.js";

export function loader({ request }: Route.LoaderArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return auth.handler(request);
}

export function action({ request }: Route.ActionArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  return auth.handler(request);
}
