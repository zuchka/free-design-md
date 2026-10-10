import { resetMetricsDatabase } from "./metrics-test-database.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDbExec, resetDbClientForTests } from "../db/client.js";
import * as quota from "./quota.js";
import { resetMetricsForTests } from "./metrics.js";

const mocks = vi.hoisted(() => ({
  verifiedOwner: vi.fn(),
  stream: vi.fn(),
}));
vi.mock("./owner.js", () => ({
  resolveAgentContextOwner: async () => "metrics-user",
  resolveVerifiedOwner: mocks.verifiedOwner,
}));
vi.mock("../../actions/enrich-design-md.js", () => ({
  enrichStream: mocks.stream,
}));
vi.mock("../../actions/iterate-design-md.js", () => ({
  iterateStream: mocks.stream,
}));
vi.mock("./saved-enrichments.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./saved-enrichments.js")>()),
  getPublicSavedEnrichment: async () => ({
    id: "parent",
    sourceUrl: "https://example.com",
    enrichedMarkdown: "# Design",
    deterministicMarkdown: "# Design",
    designSystemData: {},
    signals: {},
  }),
  saveEnrichmentSnapshot: async () => ({ id: "saved", url: "/d/saved" }),
}));

// Exercise the real H3 HTTP adapter, streaming responses, wallet and scrape route.
import { apiApp } from "../api-app.js";

const cases = [
  {
    route: "enrich",
    path: "/api/enrich-design-md",
    body: {
      url: "https://example.com",
      designSystemData: {},
      signals: {},
      screenshotDataUrl: "data:image/png;base64,AA",
      deterministicMarkdown: "# Design",
    },
  },
  {
    route: "iterate",
    path: "/api/iterate-design-md",
    body: {
      sessionId: "metrics-session",
      previousMarkdown: "# Design",
      userPrompt: "Use a blue accent",
    },
  },
  {
    route: "saved_iterate",
    path: "/api/saved-enrichments/parent/iterate",
    body: { userPrompt: "Use a blue accent" },
  },
];

beforeEach(async () => {
  await resetMetricsDatabase();
  vi.stubEnv("DATABASE_TESTS", "true");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key-never-sent");
  vi.stubEnv("FREE_DESIGN_MD_SELF_HOSTED", "0");
  vi.stubEnv("PROMETHEUS_METRICS_TOKEN", "scrape-secret");
  await resetDbClientForTests();
  await resetMetricsForTests();
  mocks.verifiedOwner.mockResolvedValue("metrics-user");
  mocks.stream.mockImplementation(async function* () {
    yield {
      type: "done",
      markdown: "# Design",
      model: "test",
      usage: {},
      stopReason: "end_turn",
    };
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await resetDbClientForTests();
  vi.unstubAllEnvs();
});

async function fund() {
  await quota.grantPurchasedCredits({
    eventId: "evt_ai",
    eventType: "checkout.session.completed",
    ownerId: "metrics-user",
    checkoutSessionId: "cs_ai",
    packId: "credits-1",
    credits: 1,
  });
}
async function scrape() {
  const response = await apiApp.fetch(
    new Request("http://localhost/api/metrics", {
      headers: { authorization: "Bearer scrape-secret" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain(
    "text/plain; version=0.0.4",
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
  return response.text();
}

describe.each(cases)("$route HTTP metrics", ({ route, path, body }) => {
  async function request(payload: unknown = body) {
    return apiApp.fetch(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }
  const sample = (status: string, outcome: string, source = "hosted_server") =>
    `fdmd_ai_requests_total{route="${route}",status="${status}",key_source="${source}",credit_outcome="${outcome}"} 1`;

  it("records one paid success only after commit", async () => {
    await fund();
    const response = await request();
    expect(await response.text()).toContain("event: done");
    const output = await scrape();
    expect(output).toContain(sample("success", "consumed"));
    expect(output).toContain(
      `fdmd_credit_operations_total{route="${route}",event="committed"} 1`,
    );
    expect(output).toContain("fdmd_credit_wallet_balance 0");
    expect(output).not.toMatch(
      /metrics-user|test-key-never-sent|scrape-secret|example.com/,
    );
  });

  it("records sign-in and empty-wallet denials without starting AI", async () => {
    mocks.verifiedOwner.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(401);
    expect((await request()).status).toBe(402);
    const output = await scrape();
    expect(output).toContain(sample("sign_in_required", "blocked"));
    expect(output).toContain(sample("out_of_credits", "exhausted"));
    expect(output).toContain(
      `fdmd_credit_operations_total{route="${route}",event="reserved"} 0`,
    );
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("tracks self-hosted success without paid credit activity", async () => {
    vi.stubEnv("FREE_DESIGN_MD_SELF_HOSTED", "1");
    expect(await (await request()).text()).toContain("event: done");
    const output = await scrape();
    expect(output).toContain(
      sample("success", "not_consumed", "self_hosted_env"),
    );
    expect(output).toContain(
      `fdmd_credit_operations_total{route="${route}",event="reserved"} 0`,
    );
    expect(mocks.verifiedOwner).not.toHaveBeenCalled();
  });

  it("counts a successful refund on stream failure", async () => {
    await fund();
    mocks.stream.mockImplementation(async function* () {
      throw new Error("provider unavailable");
    });
    expect(await (await request()).text()).toContain("event: error");
    const output = await scrape();
    expect(output).toContain(sample("stream_error", "refunded"));
    expect(output).toContain(
      `fdmd_credit_operations_total{route="${route}",event="refunded"} 1`,
    );
    expect(output).toContain("fdmd_credit_wallet_balance 1");
  });

  it("does not report success when commit fails", async () => {
    await fund();
    vi.spyOn(quota, "commitCredit").mockRejectedValueOnce(
      new Error("commit unavailable"),
    );
    expect(await (await request()).text()).toContain("event: error");
    const output = await scrape();
    expect(output).toContain(sample("stream_error", "refunded"));
    expect(output).not.toContain(sample("success", "consumed"));
    expect(output).not.toContain(
      `fdmd_ai_stream_duration_seconds_count{route="${route}",status="success"}`,
    );
  });

  it("reports failed refunds and leaves the pending reservation visible", async () => {
    await fund();
    mocks.stream.mockImplementation(async function* () {
      throw new Error("provider unavailable");
    });
    vi.spyOn(quota, "refundCredit").mockRejectedValueOnce(
      new Error("refund unavailable"),
    );
    expect(await (await request()).text()).toContain("event: error");
    const output = await scrape();
    expect(output).toContain(sample("stream_error", "refund_failed"));
    expect(output).toContain(
      `fdmd_quota_events_total{route="${route}",event="refund_failed"} 1`,
    );
    expect(output).not.toContain(
      `fdmd_quota_events_total{route="${route}",event="refunded"}`,
    );
    expect(output).toContain(
      `fdmd_credit_reservations_pending{route="${route}"} 1`,
    );
    expect(output).toContain(
      `fdmd_credit_operations_total{route="${route}",event="refunded"} 0`,
    );
  });
});

it("protects the actual HTTP scrape with bearer or header token, independent of sign-in", async () => {
  mocks.verifiedOwner.mockResolvedValue(null);
  expect(
    (await apiApp.fetch(new Request("http://localhost/api/metrics"))).status,
  ).toBe(401);
  expect(
    (
      await apiApp.fetch(
        new Request("http://localhost/api/metrics", {
          headers: { authorization: "Bearer wrong" },
        }),
      )
    ).status,
  ).toBe(401);
  const response = await apiApp.fetch(
    new Request("http://localhost/api/metrics", {
      headers: { "x-prometheus-token": "scrape-secret" },
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("fdmd_billing_metrics_available 1");
  expect(mocks.verifiedOwner).not.toHaveBeenCalled();
});

it("exposes persistent counter read failures without breaking the scrape", async () => {
  vi.spyOn(getDbExec(), "execute").mockRejectedValueOnce(
    new Error("counter storage unavailable"),
  );
  expect(await scrape()).toContain("fdmd_persistent_metrics_available 0");
});
