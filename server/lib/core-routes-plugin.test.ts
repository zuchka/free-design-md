import { describe, expect, it, vi } from "vitest";

const mockCreateCoreRoutesPlugin = vi.hoisted(() => vi.fn((options) => options));
vi.mock("@agent-native/core/server", () => ({
  createCoreRoutesPlugin: mockCreateCoreRoutesPlugin,
}));

const mockResolveAgentContextOwner = vi.hoisted(() => vi.fn());
vi.mock("./owner.js", () => ({
  resolveAgentContextOwner: mockResolveAgentContextOwner,
}));

const { default: pluginOptions } = await import("../plugins/core-routes.js");

describe("core routes plugin", () => {
  it("scopes framework anonymous Builder routes to the fdmd anonymous owner", () => {
    expect(mockCreateCoreRoutesPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousOwner: mockResolveAgentContextOwner,
      }),
    );
    expect(pluginOptions).toEqual(
      expect.objectContaining({
        anonymousOwner: mockResolveAgentContextOwner,
      }),
    );
  });
});
