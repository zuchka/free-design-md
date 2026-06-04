import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("@agent-native/core", async () => {
  const actual = await vi.importActual<typeof import("@agent-native/core")>(
    "@agent-native/core",
  );
  return { ...actual, getSession: mockGetSession };
});

const {
  resolveOwner,
  ANONYMOUS_OWNER,
  anonymousOwnerForToken,
  isAnonymousOwner,
} = await import("./owner.js");

describe("resolveOwner", () => {
  it("returns ANONYMOUS_OWNER when no session is present", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const owner = await resolveOwner({} as never);
    expect(owner).toBe(ANONYMOUS_OWNER);
  });

  it("returns the session email when a session is present", async () => {
    mockGetSession.mockResolvedValueOnce({
      email: "matthew@builder.io",
      userId: "u-123",
    });
    const owner = await resolveOwner({} as never);
    expect(owner).toBe("matthew@builder.io");
  });

  it("returns ANONYMOUS_OWNER when session has no email", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "u-123" });
    const owner = await resolveOwner({} as never);
    expect(owner).toBe(ANONYMOUS_OWNER);
  });
});

describe("anonymous owner helpers", () => {
  it("scopes valid anonymous tokens to owner ids", () => {
    expect(anonymousOwnerForToken("browser-token_123")).toBe(
      "anonymous:browser-token_123@free-design-md.local",
    );
  });

  it("rejects unsafe anonymous tokens", () => {
    expect(anonymousOwnerForToken("../bad")).toBeNull();
    expect(anonymousOwnerForToken("short")).toBeNull();
  });

  it("identifies both legacy and token-scoped anonymous owners", () => {
    expect(isAnonymousOwner(ANONYMOUS_OWNER)).toBe(true);
    expect(
      isAnonymousOwner("anonymous:browser-token@free-design-md.local"),
    ).toBe(true);
    expect(isAnonymousOwner("matthew@builder.io")).toBe(false);
  });
});
