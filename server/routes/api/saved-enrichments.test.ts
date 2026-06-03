import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/owner", () => ({
  ANONYMOUS_OWNER: "anonymous@free-design-md.local",
  resolveOwner: mockResolveOwner,
}));

const mockResolveConnectedBuilderOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/builder-connection", () => ({
  resolveConnectedBuilderOwner: mockResolveConnectedBuilderOwner,
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
vi.mock("../../lib/anthropic-key", () => ({
  resolveAnthropicKey: mockResolveAnthropicKey,
}));

const mockDecrementCredits = vi.hoisted(() => vi.fn());
const mockRefundCredit = vi.hoisted(() => vi.fn());
vi.mock("../../lib/quota", () => ({
  decrementCredits: mockDecrementCredits,
  refundCredit: mockRefundCredit,
}));

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    getRouterParam: (
      event: { _params?: Record<string, string> },
      key: string,
    ) => event._params?.[key],
    getCookie: (
      event: { _cookies?: Record<string, string> },
      key: string,
    ) => event._cookies?.[key],
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
const { default: getHandler } = await import(
  "./saved-enrichments/[id].get.js"
);
const { default: deleteHandler } = await import(
  "./saved-enrichments/[id].delete.js"
);
const { default: iterateHandler } = await import(
  "./saved-enrichments/[id]/iterate.post.js"
);

const CONNECTED = {
  ownerId: "builder:user-123",
  builderUserId: "user-123",
  orgName: "Builder",
  orgKind: "team",
};

describe("saved enrichment API routes", () => {
  beforeEach(() => {
    mockResolveOwner.mockReset();
    mockResolveConnectedBuilderOwner.mockReset();
    mockGetPublicSavedEnrichment.mockReset();
    mockListSavedEnrichmentsForOwner.mockReset();
    mockDeleteSavedEnrichmentForOwner.mockReset();
    mockSaveEnrichmentSnapshot.mockReset();
    mockIterateStream.mockReset();
    mockResolveAnthropicKey.mockReset();
    mockDecrementCredits.mockReset();
    mockRefundCredit.mockReset();
  });

  it("publicly reads a saved enrichment without Builder Connect", async () => {
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
    expect(mockResolveOwner).not.toHaveBeenCalled();
    expect(mockResolveConnectedBuilderOwner).not.toHaveBeenCalled();
  });

  it("requires Builder Connect to list creator-owned enrichments", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(null);

    const event = {};
    const result = await listHandler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(401);
    expect(result).toEqual({ error: "builder_connect_required" });
    expect(mockListSavedEnrichmentsForOwner).not.toHaveBeenCalled();
  });

  it("lists only the connected Builder owner's enrichments", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(CONNECTED);
    mockListSavedEnrichmentsForOwner.mockResolvedValueOnce([
      { id: "saved-123", title: "Example" },
    ]);

    const result = await listHandler({} as never);

    expect(result).toEqual({
      items: [{ id: "saved-123", title: "Example" }],
    });
    expect(mockListSavedEnrichmentsForOwner).toHaveBeenCalledWith(
      "builder:user-123",
    );
  });

  it("deletes only rows owned by the connected Builder owner", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(CONNECTED);
    mockDeleteSavedEnrichmentForOwner.mockResolvedValueOnce(false);

    const event = { _params: { id: "other-user-row" } };
    const result = await deleteHandler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(404);
    expect(result).toEqual({ error: "saved enrichment not found" });
    expect(mockDeleteSavedEnrichmentForOwner).toHaveBeenCalledWith(
      "other-user-row",
      "builder:user-123",
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
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(CONNECTED);
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-server",
      source: "server",
      consumesQuota: true,
    });
    mockDecrementCredits.mockResolvedValueOnce({ ok: true, remaining: 2 });
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
      _body: { userPrompt: "Make it dark mode" },
    } as never);
    const sse = await readSse(result as ReadableStream<Uint8Array>);

    expect(sse).toContain('"savedDesignUrl":"/d/saved-456"');
    expect(mockDecrementCredits).toHaveBeenCalledWith("builder:user-123");
    expect(mockSaveEnrichmentSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: CONNECTED,
        parentId: "saved-123",
        rootId: "saved-123",
        iterationPrompt: "Make it dark mode",
        enrichedMarkdown: "# Dark mode",
      }),
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
