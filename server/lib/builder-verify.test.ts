import { describe, expect, it, vi } from "vitest";
import { verifyBuilderUser } from "./builder-verify.js";

describe("verifyBuilderUser", () => {
  it("returns the verified user on a successful 200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "abc123",
          email: "matt@builder.io",
          name: "Matt",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await verifyBuilderUser(
      {
        userId: "abc123",
        apiKey: "0123456789abcdef",
        privateKey: "bpk-deadbeef",
      },
      fetchMock,
    );

    expect(result).toEqual({
      id: "abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://builder.io/api/v1/users/abc123?apiKey=0123456789abcdef",
    );
    expect((init as RequestInit).headers).toEqual({
      Authorization: "Bearer bpk-deadbeef",
    });
  });

  it("throws if the id in the response doesn't match the requested id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "different", email: "x@y.z" }), {
        status: 200,
      }),
    );

    await expect(
      verifyBuilderUser(
        { userId: "abc123", apiKey: "k", privateKey: "bpk-x" },
        fetchMock,
      ),
    ).rejects.toThrow(/id mismatch/);
  });

  it("throws on a non-200 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 403 }));

    await expect(
      verifyBuilderUser(
        { userId: "abc123", apiKey: "k", privateKey: "bpk-x" },
        fetchMock,
      ),
    ).rejects.toThrow(/verification failed/);
  });

  it("throws if email is missing from the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "abc123" }), { status: 200 }),
      );

    await expect(
      verifyBuilderUser(
        { userId: "abc123", apiKey: "k", privateKey: "bpk-x" },
        fetchMock,
      ),
    ).rejects.toThrow(/email missing/);
  });
});
