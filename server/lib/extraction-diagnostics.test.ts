import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExtractionError,
  ExtractionTrace,
  classifyExtractionError,
  withExtractionTrace,
} from "./extraction-diagnostics";
import {
  getExtractionHealth,
  renderPrometheusMetrics,
  resetInMemoryMetricsForTests,
  resetMetricsForTests,
  withActionMetricCaller,
} from "./metrics";

describe("extraction diagnostics", () => {
  beforeEach(async () => {
    await resetMetricsForTests();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["net::ERR_NAME_NOT_RESOLVED", "navigation", "dns"],
    ["net::ERR_CERT_DATE_INVALID", "navigation", "tls"],
    ["page.goto: Timeout 15000ms exceeded", "navigation", "timeout"],
    [
      "Target page, context or browser has been closed",
      "signals",
      "browser_crash",
    ],
    [
      "Executable doesn't exist at /private/path",
      "browser",
      "browser_unavailable",
    ],
    ["Internal/private URLs are not allowed", "validation", "private_url"],
  ] as const)("classifies %s", (message, stage, code) => {
    expect(classifyExtractionError(new Error(message), stage)).toMatchObject({
      code,
      stage,
    });
  });

  it("records nested route/action instrumentation only once and preserves retries after restart", async () => {
    const log = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    await withActionMetricCaller("http", () =>
      withExtractionTrace(async (trace) => {
        trace.hostname = "example.com";
        trace.retries.push("timeout");
        await withExtractionTrace(async (inner) => {
          expect(inner.requestId).toBe(trace.requestId);
          await inner.run("signals", () => "signals");
        });
      }),
    );
    expect(log).toHaveBeenCalledTimes(1);
    resetInMemoryMetricsForTests();
    const health = await getExtractionHealth();
    expect(health).toMatchObject({
      total: 1,
      failed: 0,
      succeeded: 1,
      recoveredAfterRetry: 1,
      storage: "persistent",
    });
    const metrics = await renderPrometheusMetrics();
    expect(metrics).toContain(
      'fdmd_extraction_results_total{status="success",reason="none",stage="complete",caller="http",retried="true"} 1',
    );
    expect(metrics).toContain(
      'fdmd_extraction_recovery_events_total{kind="retry",reason="timeout",caller="http"} 1',
    );
    expect(metrics).not.toContain("example.com");
  });

  it("never logs raw errors or includes them in the public failure", async () => {
    const log = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const raw =
      "page.goto: net::ERR_CONNECTION_RESET at https://user:secret@example.com/private?token=supersecret#fragment";
    await expect(
      withActionMetricCaller("http", () =>
        withExtractionTrace(async (trace) => {
          trace.hostname = "example.com";
          await trace.run("navigation", () => {
            throw new Error(raw);
          });
        }),
      ),
    ).rejects.toMatchObject({ code: "connection", stage: "navigation" });
    const output = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(output)).toMatchObject({
      reason: "connection",
      stage: "navigation",
      hostname: "example.com",
    });
    for (const secret of [
      "supersecret",
      "token=",
      "private?",
      "user:",
      "ERR_CONNECTION_RESET",
    ])
      expect(output).not.toContain(secret);
    expect((await getExtractionHealth()).failures).toEqual([
      expect.objectContaining({ code: "connection", count: 1 }),
    ]);
  });

  it("isolates concurrent requests and keeps CLI failures out of HTTP summary", async () => {
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const first = new ExtractionTrace();
    const second = new ExtractionTrace();
    await Promise.all([
      withActionMetricCaller("http", () =>
        withExtractionTrace(async () => {
          await Promise.resolve();
        }, first),
      ),
      withExtractionTrace(async (trace) => {
        await trace.run("browser", () => {
          throw new ExtractionError("browser_crash", "browser");
        });
      }, second).catch(() => undefined),
    ]);
    expect(first.requestId).not.toBe(second.requestId);
    expect(await getExtractionHealth()).toMatchObject({ total: 1, failed: 0 });
  });
});
