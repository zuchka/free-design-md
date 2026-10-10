import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDbExec, resetDbClientForTests } from "../db/client.js";
import { resetMetricsDatabase } from "./metrics-test-database.js";
import {
  ExtractionError,
  withExtractionTrace,
} from "./extraction-diagnostics.js";
import {
  getExtractionHistory,
  recordExtractionHistory,
  type ExtractionHistoryRecord,
} from "./extraction-history.js";
import {
  renderPrometheusMetrics,
  resetInMemoryMetricsForTests,
  withActionMetricCaller,
} from "./metrics.js";

beforeEach(async () => {
  await resetMetricsDatabase();
  vi.stubEnv("DATABASE_TESTS", "true");
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
  resetInMemoryMetricsForTests();
});
afterEach(async () => {
  await resetDbClientForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function record(
  overrides: Partial<ExtractionHistoryRecord> = {},
): ExtractionHistoryRecord {
  return {
    requestId: randomUUID(),
    url: "https://example.com/pricing?token=secret",
    caller: "http",
    status: "success",
    code: "none",
    stage: "complete",
    durationMs: 10,
    upstreamStatus: 200,
    retried: false,
    ...overrides,
  };
}

describe("durable extraction request history", () => {
  it("persists one URL and matching reference per HTTP operation, including failures", async () => {
    let requestId = "";
    await expect(
      withActionMetricCaller("http", () =>
        withExtractionTrace(async (trace) => {
          requestId = trace.requestId;
          trace.setUrl("https://missing.example/pricing?token=secret#secret");
          await withExtractionTrace(async (inner) => {
            expect(inner).toBe(trace);
            await inner.run("navigation", () => {
              throw new ExtractionError("dns", "navigation");
            });
          });
        }),
      ),
    ).rejects.toMatchObject({ code: "dns" });
    await recordExtractionHistory(record({ caller: "direct" }));
    resetInMemoryMetricsForTests();
    await resetDbClientForTests();
    const history = await getExtractionHistory({ limit: 50 });
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({
      requestId,
      url: "https://missing.example/pricing",
      status: "error",
      code: "dns",
      stage: "navigation",
      retried: false,
      explanation: "We could not find that website.",
    });
    expect(history.items[0].completedAt).toBeInstanceOf(Date);
    expect(await renderPrometheusMetrics()).not.toContain("missing.example");
  });

  it("supports newest-first limits and failure filters without duplicate writes", async () => {
    const first = record();
    await recordExtractionHistory(first);
    await getDbExec().execute({
      sql: `UPDATE app.fdmd_extraction_requests SET completed_at = now() - interval '1 hour' WHERE request_id = $1`,
      args: [first.requestId],
    });
    const failure = record({
      status: "error",
      code: "access_denied",
      stage: "navigation",
      upstreamStatus: 403,
    });
    await recordExtractionHistory(failure);
    await recordExtractionHistory(failure);
    const all = await getExtractionHistory({ limit: 1 });
    expect(all.hasMore).toBe(true);
    expect(all.items).toHaveLength(1);
    expect(all.items[0]).toMatchObject({
      requestId: failure.requestId,
      upstreamStatus: 403,
    });
    const errors = await getExtractionHistory({ limit: 100, status: "error" });
    expect(errors.hasMore).toBe(false);
    expect(errors.items).toHaveLength(1);
    expect(
      (await getExtractionHistory({ limit: 100, status: "success" })).items,
    ).toHaveLength(1);
  });

  it("excludes expired history and prunes it on subsequent writes", async () => {
    const expired = record();
    await recordExtractionHistory(expired);
    await getDbExec().execute({
      sql: `UPDATE app.fdmd_extraction_requests SET completed_at = now() - interval '31 days' WHERE request_id = $1`,
      args: [expired.requestId],
    });
    expect((await getExtractionHistory({ limit: 50 })).items).toEqual([]);
    await recordExtractionHistory(record({ url: null }));
    const result = await getDbExec().execute(
      `SELECT url FROM app.fdmd_extraction_requests`,
    );
    expect(result.rows).toEqual([{ url: null }]);
  });

  it("allows the runtime role to write/read history while denying public API roles", async () => {
    await getDbExec().transaction(async (db) => {
      await db.execute("SET LOCAL ROLE free_design_app");
      await db.execute({
        sql: `INSERT INTO app.fdmd_extraction_requests (request_id, url, caller, status, code, stage, duration_ms, retried) VALUES ($1, 'https://example.com/', 'http', 'success', 'none', 'complete', 10, false)`,
        args: [randomUUID()],
      });
      expect(
        (await db.execute("SELECT url FROM app.fdmd_extraction_requests")).rows,
      ).toEqual([{ url: "https://example.com/" }]);
      await db.execute("DELETE FROM app.fdmd_extraction_requests");
    });
    for (const role of ["anon", "authenticated"]) {
      await expect(
        getDbExec().transaction(async (db) => {
          await db.execute(`SET LOCAL ROLE ${role}`);
          await db.execute("SELECT * FROM app.fdmd_extraction_requests");
        }),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
