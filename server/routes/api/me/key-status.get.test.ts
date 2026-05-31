import { describe, expect, it, vi } from "vitest";

const mockGetBYOKeyForEvent = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/byo-key", () => ({
  getBYOKeyForEvent: mockGetBYOKeyForEvent,
}));

const { default: handler } = await import("./key-status.get");

describe("GET /api/me/key-status", () => {
  it("returns byoKeyConfigured: false when no key stored", async () => {
    mockGetBYOKeyForEvent.mockResolvedValueOnce(null);
    const result = await handler({} as never);
    expect(result).toEqual({ byoKeyConfigured: false });
  });

  it("returns byoKeyConfigured: true when a key is stored", async () => {
    mockGetBYOKeyForEvent.mockResolvedValueOnce("sk-something");
    const result = await handler({} as never);
    expect(result).toEqual({ byoKeyConfigured: true });
  });
});
