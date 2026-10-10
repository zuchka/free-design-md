import { afterEach, describe, expect, it, vi } from "vitest";
import { loader } from "../../../app/routes/api.extraction-health";
import { resetMetricsForTests } from "../../lib/metrics";

const history = vi.hoisted(() => vi.fn());
vi.mock("../../lib/extraction-history.js", () => ({
  getExtractionHistory: history,
}));

describe("extraction health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    history.mockReset();
  });
  it.each([undefined, "", "   "])(
    "never exposes URLs without a configured token (%s)",
    async (token) => {
      vi.stubEnv("PROMETHEUS_METRICS_TOKEN", token);
      const response = await loader({
        request: new Request(
          "http://localhost/api/extraction-health?include=recent",
          {
            headers: { authorization: "Bearer arbitrary" },
          },
        ),
      } as never);
      expect(response.status).toBe(401);
      expect(history).not.toHaveBeenCalled();
    },
  );
  it("keeps the public summary aggregate-only", async () => {
    vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "");
    const response = await loader({
      request: new Request("http://localhost/api/extraction-health"),
    } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("recentRequests");
    expect(history).not.toHaveBeenCalled();
  });
  it.each(["authorization", "x-prometheus-token"])(
    "returns protected recent URLs with %s",
    async (header) => {
      vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "private-token");
      const records = {
        window: "last_30_days",
        storage: "persistent",
        items: [{ url: "https://missing.example/path", code: "dns" }],
      };
      history.mockResolvedValue(records);
      const response = await loader({
        request: new Request(
          "http://localhost/api/extraction-health?include=recent&status=error&limit=10",
          {
            headers: {
              [header]:
                header === "authorization"
                  ? "Bearer private-token"
                  : "private-token",
            },
          },
        ),
      } as never);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toHaveProperty("recentRequests", records);
      expect(history).toHaveBeenCalledWith({ status: "error", limit: 10 });
    },
  );
  it.each(["limit=101", "limit=-1", "limit=1.5", "limit=no", "status=invalid"])(
    "rejects invalid history filters: %s",
    async (query) => {
      vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "private-token");
      const response = await loader({
        request: new Request(
          `http://localhost/api/extraction-health?include=recent&${query}`,
          {
            headers: { authorization: "Bearer private-token" },
          },
        ),
      } as never);
      expect(response.status).toBe(400);
      expect(history).not.toHaveBeenCalled();
    },
  );
  it("reports unavailable history instead of an empty success", async () => {
    vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "private-token");
    history.mockRejectedValue(new Error("sensitive database error"));
    const response = await loader({
      request: new Request(
        "http://localhost/api/extraction-health?include=recent",
        {
          headers: { authorization: "Bearer private-token" },
        },
      ),
    } as never);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
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
