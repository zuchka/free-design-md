import { describe, expect, it, vi } from "vitest";

const mockCreateAuthPlugin = vi.hoisted(() => vi.fn((options) => options));
vi.mock("@agent-native/core/server", () => ({
  createAuthPlugin: mockCreateAuthPlugin,
}));

const { default: pluginOptions } = await import("../plugins/auth.js");

describe("auth plugin", () => {
  it("keeps SEO content routes public", () => {
    expect(mockCreateAuthPlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        publicPaths: expect.arrayContaining([
          "/",
          "/docs",
          "/examples",
          "/quality",
        ]),
      }),
    );
    expect(pluginOptions).toEqual(
      expect.objectContaining({
        publicPaths: expect.arrayContaining([
          "/",
          "/docs",
          "/examples",
          "/quality",
        ]),
      }),
    );
  });
});
