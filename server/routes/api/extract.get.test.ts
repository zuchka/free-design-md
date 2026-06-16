import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "../../lib/metrics";

const mockExtractRun = vi.hoisted(() => vi.fn());
vi.mock("../../../actions/extract-design-md", () => ({
  default: {
    run: mockExtractRun,
  },
}));

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    getQuery: (event: { _query?: Record<string, unknown> }) =>
      event._query ?? {},
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

const { default: routeHandler } = await import("./extract.get");

describe("GET /api/extract metrics", () => {
  beforeEach(() => {
    mockExtractRun.mockReset();
    resetMetricsForTests();
  });

  it("records deterministic extraction success", async () => {
    mockExtractRun.mockResolvedValueOnce({
      markdown: "# design",
      designSystemData: {},
      signals: {},
      screenshotDataUrl: "data:image/png;base64,abc",
    });

    const event = {
      _query: { url: "https://example.com", format: "json" },
    } as { _query: Record<string, unknown>; _statusCode?: number };
    await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(renderPrometheusMetrics()).toContain(
      'fdmd_extract_requests_total{status="success",format="json"} 1',
    );
    expect(renderPrometheusMetrics()).not.toContain("https://example.com");
  });

  it("records deterministic extraction bad requests", async () => {
    const event = { _query: {} } as {
      _query: Record<string, unknown>;
      _statusCode?: number;
    };
    await routeHandler(event as never);

    expect(event._statusCode).toBe(400);
    expect(renderPrometheusMetrics()).toContain(
      'fdmd_extract_requests_total{status="bad_request",format="markdown"} 1',
    );
  });
});
