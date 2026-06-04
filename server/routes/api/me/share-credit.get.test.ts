import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveQuotaOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/quota-owner", () => ({
  resolveQuotaOwner: mockResolveQuotaOwner,
}));

const mockGetSharePromoStatus = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/quota", () => ({
  getSharePromoStatus: mockGetSharePromoStatus,
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

const { default: handler } = await import("./share-credit.get");

describe("GET /api/me/share-credit", () => {
  beforeEach(() => {
    mockResolveQuotaOwner.mockReset();
    mockGetSharePromoStatus.mockReset();
  });

  it("401s when no quota owner is available", async () => {
    mockResolveQuotaOwner.mockResolvedValueOnce(null);

    const event = {};
    const result = await handler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(401);
    expect(result).toEqual({ error: "builder_connect_required" });
    expect(mockGetSharePromoStatus).not.toHaveBeenCalled();
  });

  it("returns the share promo status for the quota owner", async () => {
    mockResolveQuotaOwner.mockResolvedValueOnce("builder:user-123");
    mockGetSharePromoStatus.mockResolvedValueOnce({
      campaign: "share-v1",
      credits: 3,
      claimed: false,
    });

    const result = await handler({} as never);

    expect(result).toEqual({
      campaign: "share-v1",
      credits: 3,
      claimed: false,
    });
    expect(mockGetSharePromoStatus).toHaveBeenCalledWith("builder:user-123");
  });
});
