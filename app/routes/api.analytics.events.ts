import type { ActionFunctionArgs } from "react-router";
import { clientEventSchema } from "../../shared/analytics.js";
import { recordClientGrowthEvent } from "../../server/lib/analytics.js";
import {
  analyticsHeaders,
  readAnalyticsBody,
} from "../../server/lib/analytics-http.js";
import { recordDesignArtifactEvent } from "../../server/lib/metrics.js";
export async function action({ request }: ActionFunctionArgs) {
  const parsed = clientEventSchema.safeParse(await readAnalyticsBody(request));
  if (!parsed.success)
    return Response.json(
      { error: "Invalid event" },
      { status: 400, headers: analyticsHeaders },
    );
  const event = parsed.data;
  if (event.name !== "page_viewed")
    await recordDesignArtifactEvent({
      action:
        event.name === "artifact_copied"
          ? "copy"
          : event.name === "artifact_downloaded"
            ? "download"
            : "share_link_copy",
      source: event.surface || "home",
      variant: event.variant || "deterministic",
      format: event.format || "markdown",
    });
  await recordClientGrowthEvent(request, parsed.data);
  return new Response(null, { status: 204, headers: analyticsHeaders });
}
