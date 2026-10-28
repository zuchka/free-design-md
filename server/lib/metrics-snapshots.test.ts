import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../db/index.js", () => ({ getDbExec: () => ({ execute }) }));
import {
  getExtractionHealth,
  renderPrometheusMetrics,
  resetInMemoryMetricsForTests,
} from "./metrics";

beforeEach(() => {
  vi.stubEnv("DATABASE_TESTS", "true");
  resetInMemoryMetricsForTests();
  execute.mockReset().mockImplementation(async (query) => ({
    rows:
      typeof query === "string"
        ? [{ purchases: [], operations: [], balance: 0 }]
        : [
            {
              name: "fdmd_action_runs_total",
              labels_json:
                '{"action":"extract-design-md","status":"success","caller":"http"}',
              value: 3,
            },
          ],
  }));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("shares database snapshots between health polling and repeated metrics scrapes", async () => {
  const first = await renderPrometheusMetrics();
  expect(first).toContain("fdmd_persistent_metrics_available 1");
  expect(first).toContain("fdmd_billing_metrics_available 1");
  await Promise.all([
    renderPrometheusMetrics(),
    getExtractionHealth(),
    renderPrometheusMetrics(),
  ]);
  expect(execute).toHaveBeenCalledTimes(2);
});

it("reports outages after expiry and recovers on the next scrape", async () => {
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  await renderPrometheusMetrics();
  now += 120_000;
  execute.mockRejectedValue(new Error("offline"));
  const failed = await renderPrometheusMetrics();
  expect(failed).toContain("fdmd_persistent_metrics_available 0");
  expect(failed).toContain("fdmd_billing_metrics_available 0");
  expect(failed).not.toContain("fdmd_credit_wallet_balance");
  execute.mockResolvedValue({ rows: [] });
  const recovered = await renderPrometheusMetrics();
  expect(recovered).toContain("fdmd_persistent_metrics_available 1");
  expect(execute).toHaveBeenCalledTimes(6);
});
