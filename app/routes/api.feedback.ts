import type { Route } from "./+types/api.feedback";
import submitFeedback from "../../actions/submit-feedback.js";

export async function action({ request }: Route.ActionArgs) {
  try {
    return Response.json(await submitFeedback.run(await request.json()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Feedback failed." },
      { status: 400 },
    );
  }
}
