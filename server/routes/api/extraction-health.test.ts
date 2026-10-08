import { afterEach, describe, expect, it, vi } from "vitest";
import { loader } from "../../../app/routes/api.extraction-health";
import { resetMetricsForTests } from "../../lib/metrics";

describe("extraction health", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("uses the same optional token protection as Prometheus", async () => {
    vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "private-token");
    const response = await loader({
      request: new Request("http://localhost/api/extraction-health"),
    } as never);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("makes the reporting window explicit and reports no data rather than a false zero failure rate", async () => {
    await resetMetricsForTests();
    vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "private-token");
    const response = await loader({
      request: new Request("http://localhost/api/extraction-health", {
        headers: { authorization: "Bearer private-token" },
      }),
    } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 0,
      failureRate: null,
      window: "since_diagnostics_rollout",
    });
  });
});
