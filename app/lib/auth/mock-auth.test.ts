// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetForTests,
  consumeQuota,
  getCurrentUser,
  quotaRemaining,
  signIn,
  signOut,
  subscribe,
} from "./mock-auth";

describe("mock-auth", () => {
  beforeEach(() => {
    _resetForTests();
  });
  afterEach(() => {
    _resetForTests();
  });

  it("returns null user before sign-in and full quota by default", () => {
    expect(getCurrentUser()).toBeNull();
    expect(quotaRemaining()).toBe(3);
  });

  it("signIn persists the user and seeds the quota", () => {
    const user = signIn("matt@builder.io");
    expect(user.email).toBe("matt@builder.io");
    expect(getCurrentUser()).toEqual({ email: "matt@builder.io" });
    expect(quotaRemaining()).toBe(3);
  });

  it("signOut clears the user but preserves the quota", () => {
    signIn("matt@builder.io");
    consumeQuota();
    expect(quotaRemaining()).toBe(2);
    signOut();
    expect(getCurrentUser()).toBeNull();
    // Quota does NOT replenish on sign-out — closing the loophole where a
    // user could sign out and back in to get a fresh 3 credits.
    expect(quotaRemaining()).toBe(2);
  });

  it("consumeQuota decrements and reports remaining", () => {
    signIn("matt@builder.io");
    expect(consumeQuota()).toEqual({ ok: true, remaining: 2 });
    expect(consumeQuota()).toEqual({ ok: true, remaining: 1 });
    expect(consumeQuota()).toEqual({ ok: true, remaining: 0 });
  });

  it("consumeQuota refuses to go below zero", () => {
    signIn("matt@builder.io");
    consumeQuota();
    consumeQuota();
    consumeQuota();
    expect(quotaRemaining()).toBe(0);
    expect(consumeQuota()).toEqual({ ok: false, remaining: 0 });
    expect(quotaRemaining()).toBe(0);
  });

  it("subscribe fires on sign-in, sign-out, and consume", () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls += 1;
    });
    signIn("matt@builder.io");
    expect(calls).toBe(1);
    consumeQuota();
    expect(calls).toBe(2);
    signOut();
    expect(calls).toBe(3);
    unsubscribe();
    signIn("matt@builder.io");
    expect(calls).toBe(3);
  });
});
