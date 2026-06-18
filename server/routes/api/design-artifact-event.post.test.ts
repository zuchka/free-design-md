import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "../../lib/metrics";

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    readBody: async (event: { _body: unknown }) => event._body,
    setResponseStatus: (event: { _statusCode?: number }, status: number) => {
      event._statusCode = status;
    },
  };
});

const { default: routeHandler } = await import("./design-artifact-event.post");

describe("POST /api/design-artifact-event", () => {
  beforeEach(async () => {
    await resetMetricsForTests();
  });

  it("records a bounded design artifact event", async () => {
    const event = {
      _body: {
        action: "copy",
        source: "example",
        variant: "enriched",
        format: "markdown",
      },
    } as { _body: unknown; _statusCode?: number };

    const result = await routeHandler(event as never);

    expect(event._statusCode ?? 200).toBe(200);
    expect(result).toEqual({ ok: true });
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_design_artifact_events_total{action="copy",source="example",variant="enriched",format="markdown"} 1',
    );
  });

  it("rejects arbitrary labels", async () => {
    const event = {
      _body: {
        action: "copy",
        source: "https://example.com/too-specific",
        variant: "enriched",
        format: "markdown",
      },
    } as { _body: unknown; _statusCode?: number };

    const result = await routeHandler(event as never);

    expect(event._statusCode).toBe(400);
    expect(result).toEqual({ error: "invalid_design_artifact_event" });
    expect(await renderPrometheusMetrics()).not.toContain(
      'source="https://example.com/too-specific"',
    );
  });
});
