import { timingSafeEqual } from "node:crypto";

function matchesToken(actual: string | null | undefined, expected: string) {
  if (!actual) return false;
  const candidate = Buffer.from(actual);
  const token = Buffer.from(expected);
  return candidate.length === token.length && timingSafeEqual(candidate, token);
}

export function hasMetricsAccess(
  authorization: string | null | undefined,
  headerToken: string | null | undefined,
): boolean {
  const token = process.env.PROMETHEUS_METRICS_TOKEN?.trim();
  if (!token) {
    // A missing deployment secret must never publish hosted business metrics.
    return (
      process.env.NODE_ENV !== "production" ||
      process.env.FREE_DESIGN_MD_SELF_HOSTED === "1"
    );
  }
  return (
    matchesToken(authorization, `Bearer ${token}`) ||
    matchesToken(headerToken, token)
  );
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
