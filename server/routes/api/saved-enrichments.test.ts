import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/owner", () => ({
  resolveOwner: mockResolveOwner,
}));

const mockResolveConnectedBuilderOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/builder-connection", () => ({
  resolveConnectedBuilderOwner: mockResolveConnectedBuilderOwner,
}));

const mockGetPublicSavedEnrichment = vi.hoisted(() => vi.fn());
const mockListSavedEnrichmentsForOwner = vi.hoisted(() => vi.fn());
const mockDeleteSavedEnrichmentForOwner = vi.hoisted(() => vi.fn());
vi.mock("../../lib/saved-enrichments", () => ({
  getPublicSavedEnrichment: mockGetPublicSavedEnrichment,
  listSavedEnrichmentsForOwner: mockListSavedEnrichmentsForOwner,
  deleteSavedEnrichmentForOwner: mockDeleteSavedEnrichmentForOwner,
}));

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    getRouterParam: (
      event: { _params?: Record<string, string> },
      key: string,
    ) => event._params?.[key],
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
});
