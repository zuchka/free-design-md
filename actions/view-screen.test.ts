import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadAppState = vi.hoisted(() => vi.fn());
const mockGetRequestRunContext = vi.hoisted(() => vi.fn());

vi.mock("@agent-native/core/application-state", () => ({
  readAppState: mockReadAppState,
}));

vi.mock("@agent-native/core/server", async () => {
  const actual = await vi.importActual<
    typeof import("@agent-native/core/server")
  >("@agent-native/core/server");
  return {
    ...actual,
    getRequestRunContext: mockGetRequestRunContext,
  };
});

import viewScreenAction from "./view-screen";

function navigationState(url: string, currentMarkdown: string) {
  return {
    view: "design-md",
    url,
    title: url,
    stage: "enriched",
    updatedAt: "2026-06-04T12:00:00.000Z",
    currentMarkdown,
    deterministicMarkdown: currentMarkdown,
    designSystemData: { source: url },
  };
}

describe("view-screen action", () => {
  beforeEach(() => {
    mockReadAppState.mockReset();
    mockGetRequestRunContext.mockReset();
  });

  it("prefers tab-scoped design context over owner-level fallback", async () => {
    mockGetRequestRunContext.mockReturnValue({ browserTabId: "stripe-tab" });
    mockReadAppState.mockImplementation(async (key: string) => {
      if (key === "navigation:stripe-tab") {
        return navigationState("https://stripe.com", "Stripe design.md");
      }
      if (key === "navigation") {
        return navigationState("https://thalesgroup.com", "Thales design.md");
      }
      return null;
    });

    const result = await viewScreenAction.run({});

    expect(mockReadAppState).toHaveBeenCalledTimes(1);
    expect(mockReadAppState).toHaveBeenCalledWith("navigation:stripe-tab");
    expect(result).toMatchObject({
      view: "design-md",
      url: "https://stripe.com",
      currentMarkdown: "Stripe design.md",
    });
  });

  it("falls back to owner-level context when no scoped context is available", async () => {
    mockGetRequestRunContext.mockReturnValue({ browserTabId: "stripe-tab" });
    mockReadAppState.mockImplementation(async (key: string) => {
      if (key === "navigation:stripe-tab") return null;
      if (key === "navigation") {
        return navigationState("https://stripe.com", "Fallback design.md");
      }
      return null;
    });

    const result = await viewScreenAction.run({});

    expect(mockReadAppState).toHaveBeenNthCalledWith(
      1,
      "navigation:stripe-tab",
    );
    expect(mockReadAppState).toHaveBeenNthCalledWith(2, "navigation");
    expect(result).toMatchObject({
      view: "design-md",
      url: "https://stripe.com",
      currentMarkdown: "Fallback design.md",
    });
  });
});
