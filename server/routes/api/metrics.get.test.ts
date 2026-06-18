import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordExtractRequest, resetMetricsForTests } from "../../lib/metrics";

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    getHeader: (
      event: { _requestHeaders?: Record<string, string> },
      key: string,
    ) => event._requestHeaders?.[key.toLowerCase()],
    setResponseStatus: (event: { _statusCode?: number }, status: number) => {
      event._statusCode = status;
    },
    setResponseHeader: (
      event: { _headers?: Record<string, string> },
      key: string,
      value: string,
    ) => {
      event._headers = event._headers || {};
      event._headers[key] = value;
    },
  };
});

const { default: routeHandler } = await import("./metrics.get");

const ORIGINAL_TOKEN = process.env.PROMETHEUS_METRICS_TOKEN;

describe("GET /api/metrics", () => {
  beforeEach(async () => {
    await resetMetricsForTests();
    delete process.env.PROMETHEUS_METRICS_TOKEN;
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.PROMETHEUS_METRICS_TOKEN;
    } else {
      process.env.PROMETHEUS_METRICS_TOKEN = ORIGINAL_TOKEN;
    }
  });

  it("returns Prometheus text", async () => {
    await recordExtractRequest({
      status: "success",
      format: "json",
      startedAt: Date.now() / 1000,
    });

    const event = {} as {
      _headers?: Record<string, string>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(event._headers?.["Content-Type"]).toContain("text/plain");
    expect(result).toContain("fdmd_extract_requests_total");
  });

  it("requires a token when configured", async () => {
    process.env.PROMETHEUS_METRICS_TOKEN = "secret";

    const event = {} as {
      _headers?: Record<string, string>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode).toBe(401);
    expect(result).toBe("metrics token required");
  });

  it("accepts bearer token authentication", async () => {
    process.env.PROMETHEUS_METRICS_TOKEN = "secret";

    const event = {
      _requestHeaders: { authorization: "Bearer secret" },
    } as {
      _headers?: Record<string, string>;
      _requestHeaders?: Record<string, string>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(result).toContain("# HELP");
  });
});
