import type { Route } from "./+types/api.feedback";
import submitFeedback from "../../actions/submit-feedback.js";
import { migrationWritePauseResponse } from "../../server/lib/migration-maintenance.js";

export async function action({ request }: Route.ActionArgs) {
  const maintenanceResponse = migrationWritePauseResponse(request);
  if (maintenanceResponse) return maintenanceResponse;
  try {
    return Response.json(await submitFeedback.run(await request.json()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Feedback failed." },
      { status: 400 },
    );
  }
}
