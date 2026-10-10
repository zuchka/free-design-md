export function hasMetricsAccess(
  authorization: string | null | undefined,
  headerToken: string | null | undefined,
): boolean {
  const token = process.env.PROMETHEUS_METRICS_TOKEN?.trim();
  return !token || authorization === `Bearer ${token}` || headerToken === token;
}

/** Request URLs require a configured token even when aggregates are public. */
export function hasPrivateMetricsAccess(
  authorization: string | null | undefined,
  headerToken: string | null | undefined,
): boolean {
  return (
    Boolean(process.env.PROMETHEUS_METRICS_TOKEN?.trim()) &&
    hasMetricsAccess(authorization, headerToken)
  );
}
