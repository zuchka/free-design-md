import { describe, expect, it, vi } from "vitest";

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    setResponseStatus: (event: { _statusCode?: number }, status: number) => {
      event._statusCode = status;
    },
  };
});

const { default: handler } = await import("./anthropic-key.post");

describe("POST /api/me/anthropic-key", () => {
  it("returns 410 because hosted BYO keys are disabled", async () => {
    const event = {} as { _statusCode?: number };
    const result = await handler(event as never);
    expect(event._statusCode).toBe(410);
    expect(result).toEqual(
      expect.objectContaining({ error: "user_keys_not_accepted" }),
    );
  });
});
