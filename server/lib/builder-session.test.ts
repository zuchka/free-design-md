import { describe, expect, it, beforeEach } from "vitest";
import {
  generateSessionToken,
  sessionExpiryDate,
  SESSION_COOKIE_NAME,
  STATE_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  STATE_MAX_AGE_SECONDS,
} from "./builder-session.js";
import { getDb, schema } from "../db/index.js";
import {
  createSession,
  lookupSession,
  deleteSession,
  upsertUser,
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

describe("builder-session CRUD", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdSessions);
    await db.delete(schema.fdmdUsers);
  });

  it("upsertUser inserts on first call and updates on subsequent calls", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matthew",
    });
    const db = getDb();
    const rows = await db.select().from(schema.fdmdUsers);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Matthew");
  });

  it("createSession + lookupSession round-trips and returns user fields", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    const { token } = await createSession("builder-abc123");
    const session = await lookupSession(token);
    expect(session).toEqual({
      userId: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
  });

  it("lookupSession returns null for an unknown token", async () => {
    expect(await lookupSession("not-a-real-token")).toBeNull();
  });

  it("lookupSession returns null for an expired session", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: null,
    });
    const db = getDb();
    await db.insert(schema.fdmdSessions).values({
      token: "expired-token",
      userId: "builder-abc123",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await lookupSession("expired-token")).toBeNull();
  });

  it("deleteSession removes the row", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: null,
    });
    const { token } = await createSession("builder-abc123");
    await deleteSession(token);
    expect(await lookupSession(token)).toBeNull();
  });
});
