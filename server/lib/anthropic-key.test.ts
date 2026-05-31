import { afterEach, describe, expect, it, vi } from "vitest";

const mockGetBYOKeyForEvent = vi.hoisted(() => vi.fn());

vi.mock("./byo-key.js", () => ({
  getBYOKeyForEvent: mockGetBYOKeyForEvent,
}));

const { resolveAnthropicKey } = await import("./anthropic-key.js");

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
  mockGetBYOKeyForEvent.mockReset();
});

describe("resolveAnthropicKey", () => {
  it("prefers BYO key when configured", async () => {
    mockGetBYOKeyForEvent.mockResolvedValue("sk-byo-key");
    process.env.ANTHROPIC_API_KEY = "sk-server-key";
    const r = await resolveAnthropicKey({} as never);
    expect(r).toEqual({
      apiKey: "sk-byo-key",
      source: "byo",
      consumesQuota: false,
    });
  });

  it("falls back to server key when no BYO key", async () => {
    mockGetBYOKeyForEvent.mockResolvedValue(null);
    process.env.ANTHROPIC_API_KEY = "sk-server-key";
    const r = await resolveAnthropicKey({} as never);
    expect(r).toEqual({
      apiKey: "sk-server-key",
      source: "server",
      consumesQuota: true,
    });
  });

  it("throws when neither a BYO key nor a server key is available", async () => {
    mockGetBYOKeyForEvent.mockResolvedValue(null);
    delete process.env.ANTHROPIC_API_KEY;
    await expect(resolveAnthropicKey({} as never)).rejects.toThrow(
      /no_api_key_available/,
    );
  });
});
