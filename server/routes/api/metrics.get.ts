import {
  defineEventHandler,
  getHeader,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { renderPrometheusMetrics } from "../../lib/metrics.js";
import { hasMetricsAccess } from "../../lib/metrics-access.js";

export default defineEventHandler(async (event) => {
  if (
    !hasMetricsAccess(
      getHeader(event, "authorization"),
      getHeader(event, "x-prometheus-token"),
    )
  ) {
    setResponseStatus(event, 401);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return "metrics token required";
  }

  setResponseHeader(
    event,
    "Content-Type",
    "text/plain; version=0.0.4; charset=utf-8",
  );
  setResponseHeader(event, "Cache-Control", "no-cache, no-store");
  return await renderPrometheusMetrics();
});
