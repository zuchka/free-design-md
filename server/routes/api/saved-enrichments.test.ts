import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveAgentContextOwner = vi.hoisted(() => vi.fn());
const mockResolveVerifiedOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/owner", () => ({
  ANONYMOUS_OWNER: "anonymous@free-design-md.local",
  resolveAgentContextOwner: mockResolveAgentContextOwner,
  resolveVerifiedOwner: mockResolveVerifiedOwner,
  isAnonymousOwner: (owner: string | null | undefined) =>
    owner === "anonymous@free-design-md.local" ||
    /^anonymous:[a-zA-Z0-9_-]{8,128}@free-design-md\.local$/.test(owner ?? ""),
}));

const mockGetPublicSavedEnrichment = vi.hoisted(() => vi.fn());
const mockListSavedEnrichmentsForOwner = vi.hoisted(() => vi.fn());
const mockDeleteSavedEnrichmentForOwner = vi.hoisted(() => vi.fn());
const mockSaveEnrichmentSnapshot = vi.hoisted(() => vi.fn());
vi.mock("../../lib/saved-enrichments", () => ({
  getPublicSavedEnrichment: mockGetPublicSavedEnrichment,
  listSavedEnrichmentsForOwner: mockListSavedEnrichmentsForOwner,
  deleteSavedEnrichmentForOwner: mockDeleteSavedEnrichmentForOwner,
  saveEnrichmentSnapshot: mockSaveEnrichmentSnapshot,
}));

const mockIterateStream = vi.hoisted(() => vi.fn());
vi.mock("../../../actions/iterate-design-md", () => ({
  iterateStream: mockIterateStream,
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

const mockDecrementCredits = vi.hoisted(() => vi.fn());
const mockRefundCredit = vi.hoisted(() => vi.fn());
const mockCommitCredit = vi.hoisted(() => vi.fn());
vi.mock("../../lib/quota", () => ({
  decrementCredits: mockDecrementCredits,
  refundCredit: mockRefundCredit,
  commitCredit: mockCommitCredit,
}));

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    getRouterParam: (
      event: { _params?: Record<string, string> },
      key: string,
    ) => event._params?.[key],
    getCookie: (event: { _cookies?: Record<string, string> }, key: string) =>
      event._cookies?.[key],
    getHeader: (
      event: { _requestHeaders?: Record<string, string> },
      key: string,
    ) => event._requestHeaders?.[key.toLowerCase()],
    readBody: async (event: { _body: unknown }) => event._body,
    setResponseHeader: (
      event: { _headers?: Record<string, string> },
      key: string,
      value: string,
    ) => {
      event._headers = event._headers || {};
      event._headers[key] = value;
    },
    setResponseStatus: (event: { _statusCode?: number }, status: number) => {
      event._statusCode = status;
    },
  };
});

const { default: listHandler } = await import(
  "./saved-enrichments/index.get.js"
);
const { default: getHandler } = await import("./saved-enrichments/[id].get.js");
const { default: deleteHandler } = await import(
  "./saved-enrichments/[id].delete.js"
);
const { default: iterateHandler } = await import(
  "./saved-enrichments/[id]/iterate.post.js"
);

const VERIFIED_OWNER = "user-123";

describe("saved enrichment API routes", () => {
  beforeEach(() => {
    mockResolveAgentContextOwner.mockReset();
    mockResolveAgentContextOwner.mockResolvedValue(
      "anonymous:browser-token@free-design-md.local",
    );
    mockResolveVerifiedOwner.mockReset();
    mockGetPublicSavedEnrichment.mockReset();
    mockListSavedEnrichmentsForOwner.mockReset();
    mockDeleteSavedEnrichmentForOwner.mockReset();
    mockSaveEnrichmentSnapshot.mockReset();
    mockIterateStream.mockReset();
    mockResolveAnthropicKey.mockReset();
    mockDecrementCredits.mockReset();
    mockRefundCredit.mockReset();
    mockCommitCredit.mockReset();
  });

  it("publicly reads a saved enrichment without sign-in", async () => {
    mockGetPublicSavedEnrichment.mockResolvedValueOnce({
      id: "saved-123",
      sourceUrl: "https://example.com",
      title: "Example",
      enrichedMarkdown: "# Example",
    });

    const result = await getHandler({ _params: { id: "saved-123" } } as never);

    expect(result).toMatchObject({
      id: "saved-123",
      sourceUrl: "https://example.com",
      title: "Example",
    });
    expect(mockResolveAgentContextOwner).not.toHaveBeenCalled();
    expect(mockResolveVerifiedOwner).not.toHaveBeenCalled();
  });

  it("requires a verified account to list creator-owned enrichments", async () => {
    mockResolveVerifiedOwner.mockResolvedValueOnce(null);

    const event = {};
    const result = await listHandler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(401);
    expect(result).toEqual({ error: "sign_in_required" });
    expect(mockListSavedEnrichmentsForOwner).not.toHaveBeenCalled();
  });

  it("lists only the verified owner's enrichments", async () => {
    mockResolveVerifiedOwner.mockResolvedValueOnce(VERIFIED_OWNER);
    mockListSavedEnrichmentsForOwner.mockResolvedValueOnce([
      { id: "saved-123", title: "Example" },
    ]);

    const result = await listHandler({} as never);

    expect(result).toEqual({
      items: [{ id: "saved-123", title: "Example" }],
    });
    expect(mockListSavedEnrichmentsForOwner).toHaveBeenCalledWith(
      VERIFIED_OWNER,
    );
  });

  it("deletes only rows owned by the verified owner", async () => {
    mockResolveVerifiedOwner.mockResolvedValueOnce(VERIFIED_OWNER);
    mockDeleteSavedEnrichmentForOwner.mockResolvedValueOnce(false);

    const event = { _params: { id: "other-user-row" } };
    const result = await deleteHandler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(404);
    expect(result).toEqual({ error: "saved enrichment not found" });
    expect(mockDeleteSavedEnrichmentForOwner).toHaveBeenCalledWith(
      "other-user-row",
      VERIFIED_OWNER,
    );
  });

  it("iterates a public saved enrichment and returns a new public link", async () => {
    mockGetPublicSavedEnrichment.mockResolvedValueOnce({
      id: "saved-123",
      sourceUrl: "https://example.com",
      title: "Example",
      parentId: null,
      rootId: "saved-123",
      deterministicMarkdown: "# Deterministic",
      enrichedMarkdown: "# Original",
      designSystemData: { colors: [] },
      signals: { title: "Example" },
      screenshotDataUrl: null,
    });
    mockResolveVerifiedOwner.mockResolvedValueOnce(VERIFIED_OWNER);
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-server",
      source: "server",
      consumesQuota: true,
    });
    mockDecrementCredits.mockResolvedValueOnce({
      ok: true,
      remaining: 2,
      operationId: "op-123",
    });
    mockIterateStream.mockImplementation(async function* () {
      yield { type: "delta", text: "# Dark" };
      yield {
        type: "done",
        markdown: "# Dark mode",
        model: "claude-sonnet-4-6",
        latencyMs: 1,
        usage: {},
        stopReason: "end_turn",
      };
    });
    mockSaveEnrichmentSnapshot.mockResolvedValueOnce({
      id: "saved-456",
      url: "/d/saved-456",
    });

    const result = await iterateHandler({
      _params: { id: "saved-123" },
      _body: { userPrompt: "Make it dark mode", sectionTarget: "colors" },
    } as never);
    const sse = await readSse(result as ReadableStream<Uint8Array>);

    expect(sse).toContain('"savedDesignUrl":"/d/saved-456"');
    expect(mockIterateStream).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionTarget: "colors",
        deterministicMarkdown: "# Deterministic",
      }),
    );
    expect(mockDecrementCredits).toHaveBeenCalledWith(
      VERIFIED_OWNER,
      undefined,
      "saved-iterate",
    );
    expect(mockCommitCredit).toHaveBeenCalledWith("op-123");
    expect(mockSaveEnrichmentSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { ownerId: VERIFIED_OWNER },
        parentId: "saved-123",
        rootId: "saved-123",
        iterationPrompt: "Make it dark mode",
        enrichedMarkdown: "# Dark mode",
      }),
    );
  });

  it("rejects request Anthropic keys when iterating a saved enrichment", async () => {
    mockGetPublicSavedEnrichment.mockResolvedValueOnce({
      id: "saved-123",
      sourceUrl: "https://example.com",
      title: "Example",
      parentId: null,
      rootId: "saved-123",
      deterministicMarkdown: "# Deterministic",
      enrichedMarkdown: "# Original",
      designSystemData: { colors: [] },
      signals: { title: "Example" },
      screenshotDataUrl: null,
    });

    const event = {
      _params: { id: "saved-123" },
      _requestHeaders: { "x-anthropic-api-key": "sk-request" },
      _body: { userPrompt: "Make it dark mode" },
    };
    const result = await iterateHandler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(400);
    expect(result).toMatchObject({ error: "user_keys_not_accepted" });
    expect(mockResolveAnthropicKey).not.toHaveBeenCalled();
    expect(mockIterateStream).not.toHaveBeenCalled();
  });

  it("allows self-host saved-enrichment iteration without spending quota", async () => {
    mockGetPublicSavedEnrichment.mockResolvedValueOnce({
      id: "saved-123",
      sourceUrl: "https://example.com",
      title: "Example",
      parentId: null,
      rootId: "saved-123",
      deterministicMarkdown: "# Deterministic",
      enrichedMarkdown: "# Original",
      designSystemData: { colors: [] },
      signals: { title: "Example" },
      screenshotDataUrl: null,
    });
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-self-host",
      source: "self-host",
      consumesQuota: false,
    });
    mockIterateStream.mockImplementation(async function* () {
      yield {
        type: "done",
        markdown: "# Local",
        model: "claude-sonnet-4-6",
        latencyMs: 1,
        usage: {},
        stopReason: "end_turn",
      };
    });
    mockSaveEnrichmentSnapshot.mockResolvedValueOnce({
      id: "saved-local",
      url: "/d/saved-local",
    });

    const result = await iterateHandler({
      _params: { id: "saved-123" },
      _body: { userPrompt: "Make it local" },
      _cookies: { fdmd_anon: "local-token" },
    } as never);
    const sse = await readSse(result as ReadableStream<Uint8Array>);

    expect(sse).toContain('"savedDesignUrl":"/d/saved-local"');
    expect(mockDecrementCredits).not.toHaveBeenCalled();
    expect(mockIterateStream).toHaveBeenCalledWith(
      expect.not.objectContaining({ anthropicApiKey: expect.anything() }),
    );
  });
});

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
