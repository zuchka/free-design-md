import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDbClient } from "../db/client.js";
import { getDbExec } from "../db/index.js";
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
  await db.batch([
    {
      sql: "DELETE FROM app.stripe_events WHERE event_id LIKE 'evt_test_%'",
      args: [],
    },
    {
      sql: "DELETE FROM app.purchases WHERE owner_id = $1",
      args: [TEST_OWNER],
    },
    {
      sql: "DELETE FROM app.credit_ledger WHERE owner_id = $1",
      args: [TEST_OWNER],
    },
    {
      sql: "DELETE FROM app.credit_operations WHERE owner_id = $1",
      args: [TEST_OWNER],
    },
    {
      sql: "DELETE FROM app.credit_wallets WHERE owner_id = $1",
      args: [TEST_OWNER],
    },
  ]);
}

beforeEach(async () => {
  await reset();
});
afterEach(reset);
afterAll(closeDbClient);

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
    expect(await getCredits(TEST_OWNER)).toEqual({
      remaining: 10,
      allowed: 10,
    });
  });

  it("does not fulfill the same checkout under a second event id", async () => {
    const purchase = {
      eventId: "evt_test_checkout_1",
      eventType: "checkout.session.completed",
      ownerId: TEST_OWNER,
      checkoutSessionId: "cs_test_checkout_once",
      packId: "credits-10",
      credits: 10,
    };
    expect(await grantPurchasedCredits(purchase)).toBe(true);
    expect(
      await grantPurchasedCredits({
        ...purchase,
        eventId: "evt_test_checkout_2",
      }),
    ).toBe(false);
    expect(await getCredits(TEST_OWNER)).toEqual({
      remaining: 10,
      allowed: 10,
    });
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

    const refundable = await decrementCredits(
      TEST_OWNER,
      "op-test-2",
      "iterate",
    );
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

  it("never spends below zero under concurrent reservations", async () => {
    await grantPurchasedCredits({
      eventId: "evt_test_concurrency",
      eventType: "checkout.session.completed",
      ownerId: TEST_OWNER,
      checkoutSessionId: "cs_test_concurrency",
      packId: "credits-10",
      credits: 10,
    });

    const results = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        decrementCredits(TEST_OWNER, `op-test-concurrent-${index}`),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(10);
    expect(await getCredits(TEST_OWNER)).toEqual({ remaining: 0, allowed: 10 });
  });
});
