import type { LoaderFunctionArgs } from "react-router";
import { requireAnalyticsAdmin } from "../../server/lib/analytics-admin.js";
import {
  getCachedGrowthReport,
  growthReportCsv,
  reportOptions,
} from "../../server/lib/analytics-queries.js";
import { analyticsHeaders } from "../../server/lib/analytics-http.js";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAnalyticsAdmin(request);
  const url = new URL(request.url);
  const options = reportOptions(url);
  try {
    const report = await getCachedGrowthReport(options);
    if (url.searchParams.get("format") === "csv")
      return new Response(growthReportCsv(report), {
        headers: {
          ...analyticsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=growth-analytics.csv",
        },
      });
    return Response.json(report, { headers: analyticsHeaders });
  } catch {
    return Response.json(
      {
        available: false,
        error:
          "Analytics unavailable. Check database migrations and connectivity.",
      },
      { status: 503, headers: analyticsHeaders },
    );
  }
}
