import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/owner", () => ({
  ANONYMOUS_OWNER: "anonymous@free-design-md.local",
  resolveOwner: mockResolveOwner,
}));

const mockResolveConnectedBuilderQuotaOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/builder-connection", () => ({
  resolveConnectedBuilderQuotaOwner: mockResolveConnectedBuilderQuotaOwner,
}));

const mockGetCredits = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/quota", () => ({
  getCredits: mockGetCredits,
}));

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    setResponseStatus: (event: { _statusCode?: number }, status: number) => {
      event._statusCode = status;
    },
  };
});

const { default: handler } = await import("./credits.get");

describe("GET /api/me/credits", () => {
  beforeEach(() => {
    mockResolveOwner.mockReset();
    mockResolveConnectedBuilderQuotaOwner.mockReset();
    mockGetCredits.mockReset();
  });

  it("401s for anonymous visitors without Builder Connect", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderQuotaOwner.mockResolvedValueOnce(null);

    const event = {};
    const result = await handler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(401);
    expect(result).toEqual({ error: "builder_connect_required" });
    expect(mockGetCredits).not.toHaveBeenCalled();
  });

  it("returns Builder-connected credits for anonymous visitors", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderQuotaOwner.mockResolvedValueOnce(
      "builder:user-123",
    );
    mockGetCredits.mockResolvedValueOnce({ remaining: 2, allowed: 3 });

    const result = await handler({} as never);

    expect(result).toEqual({ remaining: 2, allowed: 3 });
    expect(mockGetCredits).toHaveBeenCalledWith("builder:user-123");
  });

  it("returns quota for authenticated owners", async () => {
    mockResolveOwner.mockResolvedValueOnce("matthew@builder.io");
    mockGetCredits.mockResolvedValueOnce({ remaining: 1, allowed: 3 });

    const result = await handler({} as never);

    expect(result).toEqual({ remaining: 1, allowed: 3 });
    expect(mockResolveConnectedBuilderQuotaOwner).not.toHaveBeenCalled();
    expect(mockGetCredits).toHaveBeenCalledWith("matthew@builder.io");
  });
});
