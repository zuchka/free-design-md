import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDbExec } from "@agent-native/core/db";
import { ANONYMOUS_OWNER } from "../../lib/owner.js";
import {
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "../../lib/metrics.js";

const mockResolveAgentContextOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/owner", () => ({
  ANONYMOUS_OWNER: "anonymous@free-design-md.local",
  resolveAgentContextOwner: mockResolveAgentContextOwner,
  isAnonymousOwner: (owner: string | null | undefined) =>
    owner === "anonymous@free-design-md.local" ||
    /^anonymous:[a-zA-Z0-9_-]{8,128}@free-design-md\.local$/.test(owner ?? ""),
}));

const mockEnrichStream = vi.hoisted(() => vi.fn());
vi.mock("../../../actions/enrich-design-md", () => ({
  enrichStream: mockEnrichStream,
}));

const mockResolveAnthropicKey = vi.hoisted(() => vi.fn());
vi.mock("../../lib/anthropic-key", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/anthropic-key")
  >("../../lib/anthropic-key");
  return {
    ...actual,
    resolveAnthropicKey: mockResolveAnthropicKey,
  };
});

const mockResolveConnectedBuilderOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/builder-connection", () => ({
  resolveConnectedBuilderOwner: mockResolveConnectedBuilderOwner,
}));

const mockSaveEnrichmentSnapshot = vi.hoisted(() => vi.fn());
vi.mock("../../lib/saved-enrichments", () => ({
  saveEnrichmentSnapshot: mockSaveEnrichmentSnapshot,
}));

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    readBody: async (event: { _body: unknown }) => event._body,
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

const { default: routeHandler } = await import("./enrich-design-md.post.js");

const BUILDER_OWNER = "builder:user-123";
const BUILDER_CONNECTION = {
  ownerId: BUILDER_OWNER,
  builderUserId: "user-123",
  orgName: "Builder",
  orgKind: "team",
};

function validEvent() {
  return {
    _body: {
      url: "https://example.com",
      designSystemData: { colors: [] },
      signals: { title: "Example" },
      screenshotDataUrl: "data:image/png;base64,abc",
      deterministicMarkdown: "---\nname: Example\n---\n",
    },
  } as unknown as Record<string, unknown>;
}

function statusOf(event: { _statusCode?: number }): number {
  return event._statusCode ?? 200;
}

async function readSse(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

async function resetQuota(owner: string) {
  const exec = getDbExec();
  await exec.execute({
    sql: `UPDATE fdmd_quota SET enrich_count = 0 WHERE user_id = ?`,
    args: [owner],
  });
}

async function quotaCount(owner: string): Promise<number> {
  const exec = getDbExec();
  const row = await exec.execute({
    sql: `SELECT enrich_count FROM fdmd_quota WHERE user_id = ?`,
    args: [owner],
  });
  return Number(
    (row.rows[0] as { enrich_count: number | bigint } | undefined)
      ?.enrich_count ?? 0,
  );
}

beforeEach(async () => {
  mockResolveAgentContextOwner.mockReset();
  mockResolveAgentContextOwner.mockResolvedValue(ANONYMOUS_OWNER);
  mockEnrichStream.mockReset();
  mockResolveAnthropicKey.mockReset();
  mockResolveConnectedBuilderOwner.mockReset();
  mockSaveEnrichmentSnapshot.mockReset();
  await resetMetricsForTests();
  await resetQuota(ANONYMOUS_OWNER);
  await resetQuota(BUILDER_OWNER);
});

describe("POST /api/enrich-design-md", () => {
  it("rejects anonymous server-key calls without Builder Connect", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-server",
      source: "server",
      consumesQuota: true,
    });
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(null);

    const event = validEvent();
    const result = await routeHandler(event as never);

    expect(statusOf(event as { _statusCode?: number })).toBe(401);
    expect(result).toMatchObject({ error: "sign_in_required" });
    expect(mockResolveConnectedBuilderOwner).toHaveBeenCalledWith(
      ANONYMOUS_OWNER,
    );
    expect(mockEnrichStream).not.toHaveBeenCalled();
  });

  it("allows anonymous server-key calls after Builder Connect", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-server",
      source: "server",
      consumesQuota: true,
    });
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(BUILDER_CONNECTION);
    mockSaveEnrichmentSnapshot.mockResolvedValueOnce({
      id: "saved-123",
      url: "/d/saved-123",
    });
    mockEnrichStream.mockImplementation(async function* () {
      yield {
        type: "done",
        markdown: "---\nname: Example\n---\n",
        model: "claude-opus-4-7",
        latencyMs: 1,
        usage: { inputTokens: 1, outputTokens: 1 },
        stopReason: "end_turn",
      };
    });

    const before = await quotaCount(BUILDER_OWNER);
    const event = validEvent();
    mockResolveAgentContextOwner.mockResolvedValueOnce(
      "anonymous:browser-token@free-design-md.local",
    );
    const result = await routeHandler(event as never);
    const sse = await readSse(result as ReadableStream<Uint8Array>);

    expect(statusOf(event as { _statusCode?: number })).toBe(200);
    expect(mockResolveConnectedBuilderOwner).toHaveBeenCalledWith(
      "anonymous:browser-token@free-design-md.local",
    );
    expect(await quotaCount(BUILDER_OWNER)).toBe(before + 1);
    expect(sse).toContain('"savedDesignId":"saved-123"');
    expect(sse).toContain('"savedDesignUrl":"/d/saved-123"');
    expect(mockSaveEnrichmentSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: BUILDER_CONNECTION,
        sourceUrl: "https://example.com",
        enrichedMarkdown: "---\nname: Example\n---\n",
      }),
    );
    expect(mockEnrichStream).toHaveBeenCalledWith(
      expect.not.objectContaining({ anthropicApiKey: expect.anything() }),
    );
    const metrics = await renderPrometheusMetrics();
    expect(metrics).toContain(
      'fdmd_enrich_requests_total{status="success",key_source="hosted_server",quota="consumed"} 1',
    );
    expect(metrics).toContain(
      'fdmd_quota_events_total{route="enrich",event="decremented"} 1',
    );
    expect(metrics).not.toContain("https://example.com");
  });

  it("allows self-host calls without Builder Connect and does not spend quota", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-self-host",
      source: "self-host",
      consumesQuota: false,
    });
    mockEnrichStream.mockImplementation(async function* () {
      yield {
        type: "done",
        markdown: "---\nname: Example\n---\n",
        model: "claude-opus-4-7",
        latencyMs: 1,
        usage: { inputTokens: 1, outputTokens: 1 },
        stopReason: "end_turn",
      };
    });

    const before = await quotaCount(ANONYMOUS_OWNER);
    const event = validEvent();
    const result = await routeHandler(event as never);
    await readSse(result as ReadableStream<Uint8Array>);

    expect(statusOf(event as { _statusCode?: number })).toBe(200);
    expect(await quotaCount(ANONYMOUS_OWNER)).toBe(before);
    expect(mockSaveEnrichmentSnapshot).not.toHaveBeenCalled();
  });

  it("rejects request Anthropic keys in headers", async () => {
    const event = {
      ...validEvent(),
      _requestHeaders: { "x-anthropic-api-key": "sk-request" },
    };
    const result = await routeHandler(event as never);

    expect(statusOf(event as { _statusCode?: number })).toBe(400);
    expect(result).toEqual(
      expect.objectContaining({ error: "user_keys_not_accepted" }),
    );
    expect(mockResolveAnthropicKey).not.toHaveBeenCalled();
    expect(mockEnrichStream).not.toHaveBeenCalled();
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_enrich_requests_total{status="user_key_rejected",key_source="none",quota="blocked"} 1',
    );
  });

  it("rejects request Anthropic keys in JSON bodies", async () => {
    const event = {
      ...validEvent(),
      _body: {
        ...(validEvent() as { _body: Record<string, unknown> })._body,
        anthropicApiKey: "sk-request",
      },
    };

    const result = await routeHandler(event as never);

    expect(statusOf(event as { _statusCode?: number })).toBe(400);
    expect(result).toEqual(
      expect.objectContaining({ error: "user_keys_not_accepted" }),
    );
    expect(mockResolveAnthropicKey).not.toHaveBeenCalled();
    expect(mockEnrichStream).not.toHaveBeenCalled();
  });

  it("returns a self-host setup error when self-host mode has no env key", async () => {
    mockResolveAnthropicKey.mockRejectedValueOnce(
      new Error("self_hosted_anthropic_key_missing"),
    );

    const event = validEvent();
    const result = await routeHandler(event as never);

    expect(statusOf(event as { _statusCode?: number })).toBe(503);
    expect(result).toMatchObject({
      error: "self_hosted_anthropic_key_missing",
    });
    expect(mockEnrichStream).not.toHaveBeenCalled();
  });
});
