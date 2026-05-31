import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("@agent-native/core", async () => {
  const actual = await vi.importActual<typeof import("@agent-native/core")>(
    "@agent-native/core",
  );
  return { ...actual, getSession: mockGetSession };
});

const { resolveOwner, ANONYMOUS_OWNER } = await import("./owner.js");

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
