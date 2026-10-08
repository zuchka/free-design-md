export function hasMetricsAccess(
  authorization: string | null | undefined,
  headerToken: string | null | undefined,
): boolean {
  const token = process.env.PROMETHEUS_METRICS_TOKEN?.trim();
  return !token || authorization === `Bearer ${token}` || headerToken === token;
}
