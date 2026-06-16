import { beforeEach, describe, expect, it } from "vitest";
import {
  metricsStartedAt,
  recordBuilderConnectResolution,
  recordEnrichRequest,
  recordExtractRequest,
  recordIterateRequest,
  recordQuotaEvent,
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "./metrics";

describe("metrics registry", () => {
  beforeEach(() => resetMetricsForTests());

  it("renders Prometheus counters and histograms", () => {
    const startedAt = metricsStartedAt();

    recordExtractRequest({ status: "success", format: "json", startedAt });
    recordEnrichRequest({
      status: "success",
      keySource: "hosted_server",
      quota: "consumed",
      startedAt,
    });
    recordIterateRequest({
      route: "iterate",
      status: "blocked",
      keySource: "hosted_server",
      quota: "blocked",
      startedAt,
    });
    recordQuotaEvent({ route: "iterate", event: "refunded" });
    recordBuilderConnectResolution({
      status: "connected",
      orgKind: "Team Plan / US",
    });

    const output = renderPrometheusMetrics();

    expect(output).toContain("# TYPE fdmd_extract_requests_total counter");
    expect(output).toContain(
      'fdmd_extract_requests_total{status="success",format="json"} 1',
    );
    expect(output).toContain(
      'fdmd_enrich_requests_total{status="success",key_source="hosted_server",quota="consumed"} 1',
    );
    expect(output).toContain(
      'fdmd_iterate_requests_total{route="iterate",status="blocked",key_source="hosted_server",quota="blocked"} 1',
    );
    expect(output).toContain(
      'fdmd_quota_events_total{route="iterate",event="refunded"} 1',
    );
    expect(output).toContain(
      'fdmd_builder_connect_resolutions_total{status="connected",org_kind="team_plan_us"} 1',
    );
    expect(output).toContain("fdmd_ai_stream_duration_seconds_bucket");
    expect(output).not.toContain("https://example.com");
    expect(output).not.toContain("user-123");
    expect(output).not.toContain("sk-");
  });

  it("can reset metrics between tests", () => {
    recordExtractRequest({
      status: "success",
      format: "markdown",
      startedAt: metricsStartedAt(),
    });

    resetMetricsForTests();

    expect(renderPrometheusMetrics()).not.toContain(
      'fdmd_extract_requests_total{status="success",format="markdown"}',
    );
  });
});
