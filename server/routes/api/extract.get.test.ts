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

vi.mock("../../../shared/design-mdx", () => ({
  designArtifactToMdx: vi.fn(() => "MDX_EXPORT"),
}));

vi.mock("../../../shared/preview-template", () => ({
  renderPreview: vi.fn(() => "<html>preview</html>"),
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
  beforeEach(async () => {
    mockExtractRun.mockReset();
    await resetMetricsForTests();
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
    } as {
      _headers?: Record<string, string>;
      _query: Record<string, unknown>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(event._headers?.["Content-Type"]).toContain("application/json");
    expect(result).toMatchObject({ markdown: "# design" });
    const metrics = await renderPrometheusMetrics();
    expect(metrics).toContain(
      'fdmd_extract_duration_seconds_count{status="success"} 1',
    );
    expect(metrics).not.toContain("fdmd_extract_requests_total");
    expect(metrics).not.toContain("https://example.com");
  });

  it("returns raw markdown by default", async () => {
    mockExtractRun.mockResolvedValueOnce({
      url: "https://example.com/",
      markdown: "# design",
      designSystemData: {},
      signals: { title: "Example" },
      screenshotDataUrl: "data:image/png;base64,abc",
    });

    const event = {
      _query: { url: "https://example.com" },
    } as {
      _headers?: Record<string, string>;
      _query: Record<string, unknown>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(event._headers?.["Content-Type"]).toContain("text/markdown");
    expect(result).toBe("# design");
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_extract_duration_seconds_count{status="success"} 1',
    );
  });

  it("returns deterministic MDX exports", async () => {
    mockExtractRun.mockResolvedValueOnce({
      url: "https://example.com/",
      markdown: "# design",
      designSystemData: {},
      signals: { title: "Example" },
      screenshotDataUrl: "data:image/png;base64,abc",
    });

    const event = {
      _query: { url: "https://example.com", format: "mdx" },
    } as {
      _headers?: Record<string, string>;
      _query: Record<string, unknown>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(event._headers?.["Content-Type"]).toContain("text/mdx");
    expect(result).toBe("MDX_EXPORT");
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_extract_duration_seconds_count{status="success"} 1',
    );
  });

  it("records deterministic extraction bad requests", async () => {
    const event = { _query: {} } as {
      _query: Record<string, unknown>;
      _statusCode?: number;
    };
    await routeHandler(event as never);

    expect(event._statusCode).toBe(400);
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_extract_duration_seconds_count{status="bad_request"} 1',
    );
  });

  it("rejects unknown response formats", async () => {
    const event = {
      _query: { url: "https://example.com", format: "xml" },
    } as {
      _headers?: Record<string, string>;
      _query: Record<string, unknown>;
      _statusCode?: number;
    };
    const result = await routeHandler(event as never);

    expect(event._statusCode).toBe(400);
    expect(event._headers?.["Content-Type"]).toContain("text/plain");
    expect(result).toContain("format must be one of");
    expect(mockExtractRun).not.toHaveBeenCalled();
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_extract_duration_seconds_count{status="bad_request"} 1',
    );
  });
});
