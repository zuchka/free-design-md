import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  sessionExpiryDate,
  SESSION_COOKIE_NAME,
  STATE_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  STATE_MAX_AGE_SECONDS,
} from "./builder-session.js";

describe("builder-session token + constants", () => {
  it("generateSessionToken returns a unique base64url string", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 base64url chars (no padding).
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("sessionExpiryDate returns an ISO string ~30 days in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = new Date(sessionExpiryDate(now));
    const diffMs = expiry.getTime() - now.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    expect(days).toBeCloseTo(30, 0);
  });

  it("cookie names and max-ages match documented conventions", () => {
    expect(SESSION_COOKIE_NAME).toBe("fdmd_session");
    expect(STATE_COOKIE_NAME).toBe("fdmd_oauth_state");
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(STATE_MAX_AGE_SECONDS).toBe(10 * 60);
  });
});
