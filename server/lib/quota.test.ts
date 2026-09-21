import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDbExec } from "../db/index.js";
import { migrateDatabase } from "../db/migrate.js";
import {
  commitCredit,
  decrementCredits,
  getCredits,
  grantPurchasedCredits,
  refundCredit,
} from "./quota.js";

const TEST_OWNER = "test-credit-wallet";

async function reset() {
  const db = getDbExec();
  await db.batch(
    [
      { sql: "DELETE FROM stripe_events WHERE event_id LIKE 'evt_test_%'", args: [] },
      { sql: "DELETE FROM purchases WHERE owner_id = ?", args: [TEST_OWNER] },
      { sql: "DELETE FROM credit_ledger WHERE owner_id = ?", args: [TEST_OWNER] },
      { sql: "DELETE FROM credit_operations WHERE owner_id = ?", args: [TEST_OWNER] },
      { sql: "DELETE FROM credit_wallets WHERE owner_id = ?", args: [TEST_OWNER] },
    ],
    "write",
  );
}

beforeEach(async () => {
  await migrateDatabase();
  await reset();
});
afterEach(reset);

describe("credit wallet", () => {
  it("starts empty instead of granting signup credits", async () => {
    expect(await getCredits(TEST_OWNER)).toEqual({ remaining: 0, allowed: 0 });
  });

  it("fulfills a Stripe pack once even when the event is retried", async () => {
    const purchase = {
      eventId: "evt_test_purchase_1",
      eventType: "checkout.session.completed",
      ownerId: TEST_OWNER,
      checkoutSessionId: "cs_test_purchase_1",
      packId: "credits-10",
      credits: 10,
      amountTotal: 900,
      currency: "usd",
    };

    expect(await grantPurchasedCredits(purchase)).toBe(true);
    expect(await grantPurchasedCredits(purchase)).toBe(false);
    expect(await getCredits(TEST_OWNER)).toEqual({ remaining: 10, allowed: 10 });
  });

  it("reserves, commits, and refunds one credit idempotently", async () => {
    await grantPurchasedCredits({
      eventId: "evt_test_purchase_2",
      eventType: "checkout.session.completed",
      ownerId: TEST_OWNER,
      checkoutSessionId: "cs_test_purchase_2",
      packId: "credits-10",
      credits: 10,
    });

    const spent = await decrementCredits(TEST_OWNER, "op-test-1", "enrich");
    expect(spent).toMatchObject({ ok: true, remaining: 9 });
    await commitCredit(spent.operationId);
    await refundCredit(TEST_OWNER, spent.operationId);
    expect((await getCredits(TEST_OWNER)).remaining).toBe(9);

    const refundable = await decrementCredits(TEST_OWNER, "op-test-2", "iterate");
    await refundCredit(TEST_OWNER, refundable.operationId);
    await refundCredit(TEST_OWNER, refundable.operationId);
    expect((await getCredits(TEST_OWNER)).remaining).toBe(9);
  });

  it("rejects spending when the wallet is empty", async () => {
    expect(await decrementCredits(TEST_OWNER, "op-test-empty")).toMatchObject({
      ok: false,
      remaining: 0,
    });
  });
});
