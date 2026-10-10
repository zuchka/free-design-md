import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbClientForTests } from "../db/client.js";
import { resetMetricsDatabase } from "./metrics-test-database.js";
import {
  getExtractionHealth,
  recordActionRun,
  recordExtractionRecovery,
  recordExtractionResult,
  renderPrometheusMetrics,
  resetInMemoryMetricsForTests,
  withActionMetricCaller,
} from "./metrics.js";

beforeEach(async () => {
  await resetMetricsDatabase();
  vi.stubEnv("DATABASE_TESTS", "true");
  resetInMemoryMetricsForTests();
});

afterEach(async () => {
  await resetDbClientForTests();
  vi.unstubAllEnvs();
});

describe("Postgres extraction diagnostics", () => {
  it("preserves HTTP outcomes and recoveries after process memory is reset", async () => {
    await withActionMetricCaller("http", async () => {
      await recordExtractionResult({
        status: "error",
        reason: "timeout",
        stage: "navigation",
        retried: false,
      });
      await recordExtractionResult({
        status: "success",
        reason: "none",
        stage: "complete",
        retried: true,
      });
      await recordExtractionRecovery("retry", "timeout");
      await recordActionRun({ action: "extract-design-md", status: "success" });
    });
    await recordExtractionResult({
      status: "error",
      reason: "dns",
      stage: "navigation",
      retried: false,
    });
    resetInMemoryMetricsForTests();

    expect(await getExtractionHealth()).toMatchObject({
      storage: "persistent",
      total: 2,
      succeeded: 1,
      failed: 1,
      recoveredAfterRetry: 1,
      failureRate: 0.5,
      failures: [{ code: "timeout", stage: "navigation", count: 1 }],
    });
    const metrics = await renderPrometheusMetrics();
    expect(metrics).toContain("fdmd_persistent_metrics_available 1");
    expect(metrics).toContain("fdmd_billing_metrics_available 1");
    expect(metrics).toContain(
      'fdmd_extraction_recovery_events_total{kind="retry",reason="timeout",caller="http"} 1',
    );
    expect(metrics).toContain(
      'fdmd_action_runs_total{action="extract-design-md",status="success",caller="http"} 1',
    );
  });
});
