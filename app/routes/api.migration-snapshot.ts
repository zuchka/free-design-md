import type { Route } from "./+types/api.migration-snapshot";
import { createMigrationSnapshotResponse } from "../../server/lib/migration-snapshot.js";

export function loader({ request }: Route.LoaderArgs) {
  return createMigrationSnapshotResponse(request);
}
