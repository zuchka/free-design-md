import { afterEach, expect, it, vi } from "vitest";
import { hasMetricsAccess, hasPrivateMetricsAccess } from "./metrics-access";

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "", "   "])(
  "fails closed in hosted production without a token (%s)",
  (token) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FREE_DESIGN_MD_SELF_HOSTED", "0");
    vi.stubEnv("PROMETHEUS_METRICS_TOKEN", token);
    expect(hasMetricsAccess(null, null)).toBe(false);
    expect(hasMetricsAccess("Bearer arbitrary", "arbitrary")).toBe(false);
  },
);

it("preserves opt-in protection for development and self-hosted aggregates", () => {
  vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "");
  vi.stubEnv("NODE_ENV", "development");
  expect(hasMetricsAccess(null, null)).toBe(true);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("FREE_DESIGN_MD_SELF_HOSTED", "1");
  expect(hasMetricsAccess(null, null)).toBe(true);
  expect(hasPrivateMetricsAccess(null, null)).toBe(false);
});

it("accepts both supported headers and rejects absent or incorrect credentials", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "  configured-secret  ");
  expect(hasMetricsAccess("Bearer configured-secret", null)).toBe(true);
  expect(hasMetricsAccess(null, "configured-secret")).toBe(true);
  expect(hasPrivateMetricsAccess(null, "configured-secret")).toBe(true);
  for (const candidate of [
    undefined,
    "",
    "wrong",
    "configured-secreu",
    "Bearer configured-secret",
  ]) {
    expect(hasMetricsAccess(null, candidate)).toBe(false);
  }
  expect(hasMetricsAccess("Basic configured-secret", null)).toBe(false);
});
