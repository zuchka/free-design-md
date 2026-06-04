import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDbExec } from "@agent-native/core/db";
import {
  DEFAULT_ALLOWED_CREDITS,
  SHARE_PROMO_BONUS_CREDITS,
  claimSharePromoCredits,
  decrementCredits,
  getCredits,
  getSharePromoStatus,
  refundCredit,
} from "./quota";

const TEST_OWNER = "test-quota@iteration.local";

async function reset() {
  const exec = getDbExec();
  await exec.execute({
    sql: `DELETE FROM fdmd_credit_promos WHERE owner_id = ?`,
    args: [TEST_OWNER],
  });
  await exec.execute({
    sql: `DELETE FROM fdmd_quota WHERE user_id = ?`,
    args: [TEST_OWNER],
  });
}

beforeEach(reset);
afterEach(reset);

describe("quota helpers", () => {
  it("getCredits seeds a row with DEFAULT_ALLOWED_CREDITS on first call", async () => {
    const { remaining, allowed } = await getCredits(TEST_OWNER);
    expect(allowed).toBe(DEFAULT_ALLOWED_CREDITS);
    expect(remaining).toBe(DEFAULT_ALLOWED_CREDITS);
  });

  it("decrementCredits decrements remaining and returns ok=true", async () => {
    await getCredits(TEST_OWNER);
    const r = await decrementCredits(TEST_OWNER);
    expect(r).toEqual({ ok: true, remaining: DEFAULT_ALLOWED_CREDITS - 1 });
  });

  it("decrementCredits returns ok=false when no credits remain", async () => {
    await getCredits(TEST_OWNER);
    for (let i = 0; i < DEFAULT_ALLOWED_CREDITS; i++) {
      const r = await decrementCredits(TEST_OWNER);
      expect(r.ok).toBe(true);
    }
    const r = await decrementCredits(TEST_OWNER);
    expect(r).toEqual({ ok: false, remaining: 0 });
  });

  it("refundCredit increments remaining (but never above allowed)", async () => {
    await getCredits(TEST_OWNER);
    await decrementCredits(TEST_OWNER);
    await refundCredit(TEST_OWNER);
    const { remaining } = await getCredits(TEST_OWNER);
    expect(remaining).toBe(DEFAULT_ALLOWED_CREDITS);
  });

  it("refundCredit when at full does not exceed allowed", async () => {
    await getCredits(TEST_OWNER);
    await refundCredit(TEST_OWNER);
    const { remaining } = await getCredits(TEST_OWNER);
    expect(remaining).toBe(DEFAULT_ALLOWED_CREDITS);
  });

  it("getCredits is idempotent — calling twice doesn't double-seed", async () => {
    await getCredits(TEST_OWNER);
    await getCredits(TEST_OWNER);
    const exec = getDbExec();
    const r = await exec.execute({
      sql: `SELECT COUNT(*) AS c FROM fdmd_quota WHERE user_id = ?`,
      args: [TEST_OWNER],
    });
    const count = Number((r.rows[0] as { c: number | bigint }).c);
    expect(count).toBe(1);
  });

  it("share promo status is unclaimed before the one-time grant", async () => {
    const status = await getSharePromoStatus(TEST_OWNER);
    expect(status).toEqual({
      campaign: "share-v1",
      credits: SHARE_PROMO_BONUS_CREDITS,
      claimed: false,
    });
  });

  it("claimSharePromoCredits adds one refill and is idempotent", async () => {
    for (let i = 0; i < DEFAULT_ALLOWED_CREDITS; i++) {
      await decrementCredits(TEST_OWNER);
    }

    const first = await claimSharePromoCredits(TEST_OWNER);
    expect(first.claimedNow).toBe(true);
    expect(first.promo.claimed).toBe(true);
    expect(first.credits).toEqual({
      allowed: DEFAULT_ALLOWED_CREDITS + SHARE_PROMO_BONUS_CREDITS,
      remaining: SHARE_PROMO_BONUS_CREDITS,
    });

    const second = await claimSharePromoCredits(TEST_OWNER);
    expect(second.claimedNow).toBe(false);
    expect(second.credits).toEqual(first.credits);
  });
});
