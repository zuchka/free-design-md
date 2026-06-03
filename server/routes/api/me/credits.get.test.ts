import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/owner", () => ({
  ANONYMOUS_OWNER: "anonymous@free-design-md.local",
  resolveOwner: mockResolveOwner,
}));

const mockResolveConnectedBuilderOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/builder-connection", () => ({
  resolveConnectedBuilderOwner: mockResolveConnectedBuilderOwner,
}));

const mockGetCredits = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/quota", () => ({
  getCredits: mockGetCredits,
  decrementCredits: async () => ({ ok: true, remaining: 0 }),
  refundCredit: async () => {},
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
    mockResolveConnectedBuilderOwner.mockReset();
    mockGetCredits.mockReset();
  });

  it("401s for anonymous visitors without Builder Connect", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(null);

    const event = {};
    const result = await handler(event as never);

    expect((event as { _statusCode?: number })._statusCode).toBe(401);
    expect(result).toEqual({ error: "builder_connect_required" });
    expect(mockGetCredits).not.toHaveBeenCalled();
  });

  it("returns Builder-connected credits for anonymous visitors", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce({
      ownerId: "builder:user-123",
      builderUserId: "user-123",
      orgName: "Builder",
      orgKind: "team",
      accountTier: "free",
      planLabel: "Free",
      hasUnlimitedCredits: false,
    });
    mockGetCredits.mockResolvedValueOnce({ remaining: 2, allowed: 3 });

    const result = await handler({} as never);

    expect(result).toEqual({
      remaining: 2,
      allowed: 3,
      unlimited: false,
      accountTier: "free",
      planLabel: "Free",
      builderOrgName: "Builder",
    });
    expect(mockGetCredits).toHaveBeenCalledWith("builder:user-123");
  });

  it("returns unlimited credits for paid Builder-connected visitors", async () => {
    mockResolveOwner.mockResolvedValueOnce("anonymous@free-design-md.local");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce({
      ownerId: "builder:user-123",
      builderUserId: "user-123",
      orgName: "Builder",
      orgKind: "team",
      accountTier: "paid",
      planLabel: "Pro",
      hasUnlimitedCredits: true,
    });

    const result = await handler({} as never);

    expect(result).toEqual({
      remaining: null,
      allowed: null,
      unlimited: true,
      accountTier: "paid",
      planLabel: "Pro",
      builderOrgName: "Builder",
    });
    expect(mockGetCredits).not.toHaveBeenCalled();
  });

  it("returns quota for authenticated owners", async () => {
    mockResolveOwner.mockResolvedValueOnce("matthew@builder.io");
    mockResolveConnectedBuilderOwner.mockResolvedValueOnce(null);
    mockGetCredits.mockResolvedValueOnce({ remaining: 1, allowed: 3 });

    const result = await handler({} as never);

    expect(result).toEqual({
      remaining: 1,
      allowed: 3,
      unlimited: false,
      accountTier: "anonymous",
      planLabel: null,
      builderOrgName: null,
    });
    expect(mockGetCredits).toHaveBeenCalledWith("matthew@builder.io");
  });
});
