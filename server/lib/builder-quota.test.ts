import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import {
  ensureQuota,
  quotaRemaining,
  consumeQuota,
  applyBuilderKeyBonus,
  quotaStatus,
  QUOTA_DEFAULT,
  QUOTA_BUILDER_BONUS,
} from "./builder-quota.js";

describe("builder-quota", () => {
  it("fdmdQuota schema has bonus_credits column", () => {
    expect(schema.fdmdQuota.bonusCredits).toBeDefined();
  });

  it("fdmdBuilderKeys table is defined in schema", () => {
    expect(schema.fdmdBuilderKeys).toBeDefined();
  });

  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdQuota);
  });

  it("QUOTA_DEFAULT is 3 to match mock-auth", () => {
    expect(QUOTA_DEFAULT).toBe(3);
  });

  it("ensureQuota seeds the row to the default on first call", async () => {
    await ensureQuota("builder-abc123");
    expect(await quotaRemaining("builder-abc123")).toBe(3);
  });

  it("ensureQuota is idempotent — does not reset existing rows", async () => {
    await ensureQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    expect(await quotaRemaining("builder-abc123")).toBe(1);
    await ensureQuota("builder-abc123");
    expect(await quotaRemaining("builder-abc123")).toBe(1);
  });

  it("quotaRemaining returns QUOTA_DEFAULT for an unseen user", async () => {
    expect(await quotaRemaining("builder-never-seen")).toBe(3);
  });

  it("consumeQuota decrements and returns ok=true while > 0", async () => {
    await ensureQuota("builder-abc123");
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: true,
      remaining: 2,
    });
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: true,
      remaining: 1,
    });
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: true,
      remaining: 0,
    });
  });

  it("consumeQuota refuses to go below zero and reports ok=false", async () => {
    await ensureQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: false,
      remaining: 0,
    });
  });
});

describe("applyBuilderKeyBonus", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdQuota);
    await db.delete(schema.fdmdBuilderKeys);
    vi.restoreAllMocks();
  });

  it("QUOTA_BUILDER_BONUS is 10", () => {
    expect(QUOTA_BUILDER_BONUS).toBe(10);
  });

  it("grants bonus credits when key is valid and unused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    await ensureQuota("user@example.com");
    const result = await applyBuilderKeyBonus("user@example.com", "validkey123");
    expect(result).toEqual({ ok: true, remaining: QUOTA_DEFAULT + QUOTA_BUILDER_BONUS });
  });

  it("quotaRemaining reflects bonus after grant", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    await ensureQuota("user@example.com");
    await applyBuilderKeyBonus("user@example.com", "validkey123");
    expect(await quotaRemaining("user@example.com")).toBe(QUOTA_DEFAULT + QUOTA_BUILDER_BONUS);
  });

  it("consumeQuota works past the base quota when bonus is applied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    await ensureQuota("user@example.com");
    // Exhaust base quota
    await consumeQuota("user@example.com");
    await consumeQuota("user@example.com");
    await consumeQuota("user@example.com");
    expect(await quotaRemaining("user@example.com")).toBe(0);
    // Apply bonus
    await applyBuilderKeyBonus("user@example.com", "validkey123");
    expect(await quotaRemaining("user@example.com")).toBe(QUOTA_BUILDER_BONUS);
    // Can still consume
    const result = await consumeQuota("user@example.com");
    expect(result).toEqual({ ok: true, remaining: QUOTA_BUILDER_BONUS - 1 });
  });

  it("returns invalid_key when Builder.io CDN rejects the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response),
    );
    const result = await applyBuilderKeyBonus("user@example.com", "badkey");
    expect(result).toEqual({ ok: false, reason: "invalid_key" });
  });

  it("returns verification_failed when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const result = await applyBuilderKeyBonus("user@example.com", "anykey");
    expect(result).toEqual({ ok: false, reason: "verification_failed" });
  });

  it("returns key_already_used when the same key is submitted twice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    await ensureQuota("user-a@example.com");
    await ensureQuota("user-b@example.com");
    await applyBuilderKeyBonus("user-a@example.com", "sharedkey");
    const result = await applyBuilderKeyBonus("user-b@example.com", "sharedkey");
    expect(result).toEqual({ ok: false, reason: "key_already_used" });
  });

  it("returns already_unlocked when the same user submits a second key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    await ensureQuota("user@example.com");
    await applyBuilderKeyBonus("user@example.com", "firstkey");
    const result = await applyBuilderKeyBonus("user@example.com", "secondkey");
    expect(result).toEqual({ ok: false, reason: "already_unlocked" });
  });
});

describe("quotaStatus", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdQuota);
    await db.delete(schema.fdmdBuilderKeys);
  });

  it("returns hasBuilderSpace=false for a new user with no linked space", async () => {
    await ensureQuota("status-user-no-space");
    const result = await quotaStatus("status-user-no-space");
    expect(result.hasBuilderSpace).toBe(false);
    expect(result.remaining).toBe(QUOTA_DEFAULT);
  });

  it("returns hasBuilderSpace=true when bonusCredits > 0", async () => {
    await ensureQuota("status-user-with-space");
    const db = getDb();
    await db
      .update(schema.fdmdQuota)
      .set({ bonusCredits: QUOTA_BUILDER_BONUS })
      .where(eq(schema.fdmdQuota.userId, "status-user-with-space"));
    const result = await quotaStatus("status-user-with-space");
    expect(result.hasBuilderSpace).toBe(true);
    expect(result.remaining).toBe(QUOTA_DEFAULT + QUOTA_BUILDER_BONUS);
  });

  it("returns hasBuilderSpace=false for an unseen user", async () => {
    const result = await quotaStatus("status-user-never-seen");
    expect(result.hasBuilderSpace).toBe(false);
    expect(result.remaining).toBe(QUOTA_DEFAULT);
  });
});
