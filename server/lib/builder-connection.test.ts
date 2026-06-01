import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveBuilderCredentials = vi.hoisted(() => vi.fn());
const mockRunWithRequestContext = vi.hoisted(
  () => vi.fn(async (_ctx: unknown, fn: () => unknown) => await fn()),
);

vi.mock("@agent-native/core/server", () => ({
  resolveBuilderCredentials: mockResolveBuilderCredentials,
  runWithRequestContext: mockRunWithRequestContext,
}));

const { resolveConnectedBuilderOwner, resolveConnectedBuilderQuotaOwner } =
  await import("./builder-connection.js");

describe("Builder Connect owner resolution", () => {
  beforeEach(() => {
    mockResolveBuilderCredentials.mockReset();
    mockRunWithRequestContext.mockClear();
  });

  it("returns a user-level owner for complete Builder credentials", async () => {
    mockResolveBuilderCredentials.mockResolvedValueOnce({
      privateKey: "private-secret",
      publicKey: "public-secret",
      userId: "user-123",
      orgName: "Builder",
      orgKind: "team",
    });

    await expect(
      resolveConnectedBuilderOwner("anonymous@free-design-md.local"),
    ).resolves.toEqual({
      ownerId: "builder:user-123",
      builderUserId: "user-123",
      orgName: "Builder",
      orgKind: "team",
    });
  });

  it("requires a Builder user id", async () => {
    mockResolveBuilderCredentials.mockResolvedValueOnce({
      privateKey: "private-secret",
      publicKey: "public-secret",
      userId: null,
    });

    await expect(resolveConnectedBuilderOwner("owner")).resolves.toBeNull();
  });

  it("keeps the quota helper on the same owner id", async () => {
    mockResolveBuilderCredentials.mockResolvedValueOnce({
      privateKey: "private-secret",
      publicKey: "public-secret",
      userId: "user-123",
    });

    await expect(resolveConnectedBuilderQuotaOwner("owner")).resolves.toBe(
      "builder:user-123",
    );
  });
});
