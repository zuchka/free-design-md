import type { LoaderFunctionArgs } from "react-router";
import { getExtractionHealth } from "../../server/lib/metrics.js";
import { hasMetricsAccess } from "../../server/lib/metrics-access.js";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = { "Cache-Control": "no-store" };
  if (
    !hasMetricsAccess(
      request.headers.get("authorization"),
      request.headers.get("x-prometheus-token"),
    )
  ) {
    return new Response("metrics token required", { status: 401, headers });
  }
  return Response.json(await getExtractionHealth(), { headers });
}
