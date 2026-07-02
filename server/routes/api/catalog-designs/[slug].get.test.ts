import { describe, expect, it, vi } from "vitest";

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return {
    ...actual,
    getRouterParam: (
      event: { _params?: Record<string, string> },
      key: string,
    ) => event._params?.[key],
    setResponseStatus: (event: { _statusCode?: number }, status: number) => {
      event._statusCode = status;
    },
  };
});

const { default: listHandler } = await import("./index.get.js");
const { default: handler } = await import("./[slug].get.js");

describe("catalog design API route", () => {
  it("lists curated catalog designs without markdown payloads", async () => {
    const result = await listHandler({} as never);

    expect(result.count).toBeGreaterThan(10);
    expect(result.categories).toContain("Fintech & Crypto");
    expect(result.designs).toContainEqual(
      expect.objectContaining({
        slug: "stripe",
        aliases: [],
        title: "Stripe",
        sourceUrl: "https://stripe.com",
        category: "Fintech & Crypto",
        hasArtifact: true,
      }),
    );
    expect(result.designs[0]).not.toHaveProperty("enrichedMarkdown");
    expect(result.designs[0]).not.toHaveProperty("deterministicMarkdown");
  });

  it("returns a curated catalog design by slug", async () => {
    const result = await handler({ _params: { slug: "stripe" } } as never);

    expect(result).toMatchObject({
      id: "stripe",
      title: "Stripe",
      enrichedMarkdown: expect.stringContaining("## Overview"),
      deterministicMarkdown: expect.stringContaining("## Colors"),
    });
  });

  it("resolves catalog aliases to canonical slugs", async () => {
    const result = await handler({ _params: { slug: "linear" } } as never);

    expect(result).toMatchObject({
      id: "linear.app",
      title: "Linear",
    });
  });

  it("returns 404 for unknown slugs", async () => {
    const event: { _params: { slug: string }; _statusCode?: number } = {
      _params: { slug: "missing" },
    };
    const result = await handler(event as never);

    expect(event._statusCode).toBe(404);
    expect(result).toEqual({ error: "catalog design not found" });
  });
});
