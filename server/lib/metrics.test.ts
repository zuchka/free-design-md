import { beforeEach, describe, expect, it } from "vitest";
import {
  metricsStartedAt,
  recordActionRun,
  recordBuilderConnectResolution,
  recordDesignArtifactEvent,
  recordEnrichRequest,
  recordExtractRequest,
  recordIterateRequest,
  recordQuotaEvent,
  renderPrometheusMetrics,
  resetInMemoryMetricsForTests,
  resetMetricsForTests,
  withActionMetricCaller,
} from "./metrics";

describe("metrics registry", () => {
  beforeEach(async () => {
    await resetMetricsForTests();
  });

  it("renders Prometheus counters and histograms", async () => {
    const startedAt = metricsStartedAt();

    await recordExtractRequest({
      status: "success",
      format: "json",
      startedAt,
    });
    await recordEnrichRequest({
      status: "success",
      keySource: "hosted_server",
      quota: "consumed",
      startedAt,
    });
    await recordIterateRequest({
      route: "iterate",
      status: "blocked",
      keySource: "hosted_server",
      quota: "blocked",
      startedAt,
    });
    await recordQuotaEvent({ route: "iterate", event: "refunded" });
    await recordBuilderConnectResolution({
      status: "connected",
      orgKind: "Team Plan / US",
    });
    await recordDesignArtifactEvent({
      action: "download",
      source: "example",
      variant: "enriched",
      format: "mdx",
    });
    await recordActionRun({
      action: "extract-design-md",
      status: "success",
    });

    const output = await renderPrometheusMetrics();

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
    expect(output).toContain(
      'fdmd_design_artifact_events_total{action="download",source="example",variant="enriched",format="mdx"} 1',
    );
    expect(output).toContain(
      'fdmd_action_runs_total{action="extract-design-md",status="success",caller="direct"} 1',
    );
    expect(output).toContain("fdmd_ai_stream_duration_seconds_bucket");
    expect(output).not.toContain("https://example.com");
    expect(output).not.toContain("user-123");
    expect(output).not.toContain("sk-");
  });

  it("can reset metrics between tests", async () => {
    await recordExtractRequest({
      status: "success",
      format: "markdown",
      startedAt: metricsStartedAt(),
    });

    await resetMetricsForTests();

    expect(await renderPrometheusMetrics()).not.toContain(
      'fdmd_extract_requests_total{status="success",format="markdown"}',
    );
  });

  it("renders persisted counters after in-memory reset", async () => {
    await recordEnrichRequest({
      status: "success",
      keySource: "hosted_server",
      quota: "consumed",
      startedAt: metricsStartedAt(),
    });

    resetInMemoryMetricsForTests();

    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_enrich_requests_total{status="success",key_source="hosted_server",quota="consumed"} 1',
    );
  });

  it("labels action runs with the active caller surface", async () => {
    await withActionMetricCaller("http", async () => {
      await recordActionRun({
        action: "iterate-design-md",
        status: "success",
      });
    });
    await recordActionRun({
      action: "iterate-design-md",
      status: "error",
    });

    const output = await renderPrometheusMetrics();

    expect(output).toContain(
      'fdmd_action_runs_total{action="iterate-design-md",status="success",caller="http"} 1',
    );
    expect(output).toContain(
      'fdmd_action_runs_total{action="iterate-design-md",status="error",caller="direct"} 1',
    );
  });
});
