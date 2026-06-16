import {
  defineEventHandler,
  getHeader,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { renderPrometheusMetrics } from "../../lib/metrics.js";

function hasMetricsAccess(event: Parameters<typeof getHeader>[0]): boolean {
  const token = process.env.PROMETHEUS_METRICS_TOKEN?.trim();
  if (!token) return true;

  const authorization = getHeader(event, "authorization");
  if (authorization === `Bearer ${token}`) return true;

  return getHeader(event, "x-prometheus-token") === token;
}

export default defineEventHandler((event) => {
  if (!hasMetricsAccess(event)) {
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
  return renderPrometheusMetrics();
});
