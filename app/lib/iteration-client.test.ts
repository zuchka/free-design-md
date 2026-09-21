// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceSession,
  getOrCreateSession,
} from "./iteration-client";

describe("iteration sessions", () => {
  beforeEach(() => localStorage.clear());

  it("keeps an existing session when the current enrichment is unchanged", () => {
    const first = getOrCreateSession("https://example.com", "current", "one");
    const second = getOrCreateSession("https://example.com", "current", "one");

    expect(second).toEqual(first);
  });

  it("starts a new chain when a fresh enrichment replaces stale markdown", () => {
    getOrCreateSession("https://example.com", "old enrichment", "old-id");
    advanceSession("https://example.com", {
      id: "old-iteration",
      markdown: "old iteration",
    });

    const synced = getOrCreateSession(
      "https://example.com",
      "fresh enrichment",
      "fresh-id",
    );

    expect(synced.current).toEqual({
      id: "fresh-id",
      markdown: "fresh enrichment",
    });
    expect(synced.previous).toBeNull();
  });

  it("adds a saved design id without discarding valid history", () => {
    const first = getOrCreateSession("https://example.com", "current");
    const synced = getOrCreateSession(
      "https://example.com",
      "current",
      "saved-id",
    );

    expect(synced.sessionId).toBe(first.sessionId);
    expect(synced.current).toEqual({ id: "saved-id", markdown: "current" });
    expect(synced.previous).toBeNull();
  });
});
