import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveQuotaOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/quota-owner", () => ({
  resolveQuotaOwner: mockResolveQuotaOwner,
}));

const mockClaimSharePromoCredits = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/quota", () => ({
  claimSharePromoCredits: mockClaimSharePromoCredits,
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

const { default: handler } = await import("./share-credit.post");

describe("POST /api/me/share-credit", () => {
  beforeEach(() => {
    mockResolveQuotaOwner.mockReset();
    mockClaimSharePromoCredits.mockReset();
  });

  it("401s when no quota owner is available", async () => {
    mockResolveQuotaOwner.mockResolvedValueOnce(null);

    const event = {};
    const result = await handler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(401);
    expect(result).toEqual({ error: "builder_connect_required" });
    expect(mockClaimSharePromoCredits).not.toHaveBeenCalled();
  });

  it("claims the one-time share promo for the quota owner", async () => {
    mockResolveQuotaOwner.mockResolvedValueOnce("builder:user-123");
    mockClaimSharePromoCredits.mockResolvedValueOnce({
      claimedNow: true,
      promo: { campaign: "share-v1", credits: 3, claimed: true },
      credits: { allowed: 6, remaining: 3 },
    });

    const result = await handler({} as never);

    expect(result).toEqual({
      claimedNow: true,
      promo: { campaign: "share-v1", credits: 3, claimed: true },
      credits: { allowed: 6, remaining: 3 },
    });
    expect(mockClaimSharePromoCredits).toHaveBeenCalledWith(
      "builder:user-123",
    );
  });
});
