// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTests,
  _hydrate,
  getCurrentUser,
  quotaRemaining,
  hasBuilderSpace,
  signOut,
  signIn,
  consumeQuota,
  subscribe,
} from "./real-auth";

const originalFetch = globalThis.fetch;
const originalLocation = window.location;

describe("real-auth", () => {
  beforeEach(() => {
    _resetForTests();
  });
  afterEach(() => {
    _resetForTests();
    globalThis.fetch = originalFetch;
  });

  it("starts signed-out with the default quota before hydration", () => {
    expect(getCurrentUser()).toBeNull();
    expect(quotaRemaining()).toBe(3);
  });

  it("_hydrate populates the cache from /api/auth/me on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await _hydrate();
    expect(getCurrentUser()).toEqual({ email: "matt@builder.io" });
    expect(quotaRemaining()).toBe(2);
  });

  it("_hydrate leaves the cache empty on a 401 response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }));
    await _hydrate();
    expect(getCurrentUser()).toBeNull();
    expect(quotaRemaining()).toBe(3);
  });

  it("signIn navigates to /sign-in with the current pathname as return", () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        assign: assignMock,
        pathname: "/some/page",
        search: "",
      },
    });

    signIn();

    expect(assignMock).toHaveBeenCalledTimes(1);
    const target = assignMock.mock.calls[0][0] as string;
    expect(target).toContain("/sign-in?return=");
    expect(decodeURIComponent(target.split("return=")[1])).toBe("/some/page");
  });

  it("signOut POSTs to /api/auth/builder/signout and clears the cache", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { email: "matt@builder.io", name: "Matt" },
            remaining: 3,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    await _hydrate();
    expect(getCurrentUser()).not.toBeNull();
    signOut();
    // Cache cleared synchronously, network call fires async.
    expect(getCurrentUser()).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/_agent-native/auth/ba/sign-out",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("consumeQuota decrements the cache optimistically and notifies subscribers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 3,
        }),
        { status: 200 },
      ),
    );
    await _hydrate();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    expect(consumeQuota()).toEqual({ ok: true, remaining: 2 });
    expect(quotaRemaining()).toBe(2);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it("consumeQuota refuses to go below zero", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 0,
        }),
        { status: 200 },
      ),
    );
    await _hydrate();
    expect(consumeQuota()).toEqual({ ok: false, remaining: 0 });
  });

  it("_hydrate populates hasBuilderSpace=true when the server says so", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 0,
          hasBuilderSpace: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await _hydrate();
    expect(hasBuilderSpace()).toBe(true);
  });

  it("_hydrate leaves hasBuilderSpace=false when field is absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 3,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await _hydrate();
    expect(hasBuilderSpace()).toBe(false);
  });
});
