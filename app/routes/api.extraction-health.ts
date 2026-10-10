import type { LoaderFunctionArgs } from "react-router";
import { getExtractionHealth } from "../../server/lib/metrics.js";
import {
  hasMetricsAccess,
  hasPrivateMetricsAccess,
} from "../../server/lib/metrics-access.js";
import { getExtractionHistory } from "../../server/lib/extraction-history.js";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = { "Cache-Control": "no-store" };
  const params = new URL(request.url).searchParams;
  const includeRecent = params.get("include") === "recent";
  if (
    !(includeRecent ? hasPrivateMetricsAccess : hasMetricsAccess)(
      request.headers.get("authorization"),
      request.headers.get("x-prometheus-token"),
    )
  ) {
    return new Response("metrics token required", { status: 401, headers });
  }
  if (!includeRecent)
    return Response.json(await getExtractionHealth(), { headers });
  const limit = Number(params.get("limit") ?? 50);
  const status = params.get("status") ?? undefined;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (status !== undefined && status !== "success" && status !== "error")
  ) {
    return Response.json(
      { error: "limit must be 1–100 and status must be success or error" },
      { status: 400, headers },
    );
  }
  try {
    return Response.json(
      {
        ...(await getExtractionHealth()),
        recentRequests: await getExtractionHistory({
          limit,
          status: status as "success" | "error" | undefined,
        }),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Extraction request history is unavailable" },
      { status: 503, headers },
    );
  }
}
