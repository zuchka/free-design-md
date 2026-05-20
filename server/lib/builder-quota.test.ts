import { beforeEach, describe, expect, it } from "vitest";
import { getDb, schema } from "../db/index.js";
import {
  ensureQuota,
  quotaRemaining,
  consumeQuota,
  QUOTA_DEFAULT,
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
