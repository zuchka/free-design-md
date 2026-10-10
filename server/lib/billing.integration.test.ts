import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { closeDbClient } from "../db/client.js";
import { getDbExec } from "../db/index.js";
import { getCredits, grantPurchasedCredits } from "./quota.js";
import { getStripe } from "./stripe.js";
import { action as checkoutAction } from "../../app/routes/api.billing.checkout.js";
import { action as webhookAction } from "../../app/routes/api.billing.webhook.js";
import { loader as purchaseLoader } from "../../app/routes/api.billing.purchase.$sessionId.js";

const fixtures = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_billing_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_billing_fixture";
  process.env.STRIPE_PRICE_10_CREDITS = "price_billing_fixture";
  process.env.PUBLIC_ORIGIN = "https://billing.example";
  process.env.MIGRATION_WRITE_PAUSED = "0";
  return { getSession: vi.fn() };
});
vi.mock("./auth.js", () => ({ getRequestSession: fixtures.getSession }));

const OWNER = "billing-integration-owner";
let sessionId: string;

function requestArgs(request: Request) {
  return { request } as Parameters<typeof checkoutAction>[0];
}

async function purchaseStatus(owner = OWNER) {
  fixtures.getSession.mockResolvedValue({
    user: {
      id: owner,
      email: "buyer@example.com",
      isAnonymous: false,
      emailVerified: true,
    },
  });
  return purchaseLoader({
    request: new Request(
      `https://billing.example/api/billing/purchase/${sessionId}`,
    ),
    params: { sessionId },
  } as Parameters<typeof purchaseLoader>[0]);
}

function webhook(
  eventId: string,
  type = "checkout.session.completed",
  paid = true,
  valid = true,
) {
  const payload = JSON.stringify({
    id: eventId,
    type,
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: paid ? "paid" : "unpaid",
        payment_intent: "pi_billing_fixture",
        amount_total: 499,
        currency: "usd",
        metadata: { ownerId: OWNER, packId: "credits-10", credits: "99999" },
      },
    },
  });
  const signature = getStripe().webhooks.generateTestHeaderString({
    payload,
    secret: valid ? process.env.STRIPE_WEBHOOK_SECRET! : "wrong-signing-secret",
  });
  return webhookAction({
    request: new Request("https://billing.example/api/billing/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signature },
    }),
  } as Parameters<typeof webhookAction>[0]);
}

beforeEach(async () => {
  // Never point these fixtures at a hosted database.
  const url = new URL(
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  );
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error("Billing integration tests require a local database");
  }
  sessionId = `cs_test_billing_${randomUUID()}`;
  fixtures.getSession.mockResolvedValue({
    user: {
      id: OWNER,
      email: "buyer@example.com",
      isAnonymous: false,
      emailVerified: true,
    },
  });
  vi.restoreAllMocks();
  vi.spyOn(getStripe().checkout.sessions, "create").mockResolvedValue({
    id: sessionId,
    url: "https://checkout.stripe.com/test-fixture",
  } as Awaited<
    ReturnType<ReturnType<typeof getStripe>["checkout"]["sessions"]["create"]>
  >);
  await getDbExec().batch([
    {
      sql: "DELETE FROM app.stripe_events WHERE event_id LIKE 'evt_billing_%'",
    },
    ...[
      "purchases",
      "credit_ledger",
      "credit_operations",
      "credit_wallets",
    ].map((table) => ({
      sql: `DELETE FROM app.${table} WHERE owner_id = $1`,
      args: [OWNER],
    })),
  ]);
});
afterAll(closeDbClient);

describe("Stripe Checkout with Postgres", () => {
  it("persists checkout, fulfills its pending purchase, and scopes status to the buyer", async () => {
    const response = await checkoutAction(
      requestArgs(
        new Request("https://billing.example/api/billing/checkout", {
          method: "POST",
          body: JSON.stringify({
            packId: "credits-10",
            ownerId: "attacker",
            credits: 99999,
          }),
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect((await (await purchaseStatus()).json()).status).toBe("pending");
    expect((await purchaseStatus("other-owner")).status).toBe(404);

    expect((await webhook("evt_billing_paid")).status).toBe(200);
    expect(await (await purchaseStatus()).json()).toEqual({
      status: "fulfilled",
      credits: 10,
      packId: "credits-10",
    });
    expect(await getCredits(OWNER)).toEqual({ remaining: 10, allowed: 10 });
    const saved = await getDbExec().execute({
      sql: "SELECT stripe_payment_intent_id, amount_total, currency, fulfilled_at FROM app.purchases WHERE stripe_checkout_session_id = $1",
      args: [sessionId],
    });
    expect(saved.rows[0]).toMatchObject({
      stripe_payment_intent_id: "pi_billing_fixture",
      amount_total: 499,
      currency: "usd",
    });
    expect(saved.rows[0].fulfilled_at).toBeTruthy();

    await webhook("evt_billing_paid");
    await webhook(
      "evt_billing_async",
      "checkout.session.async_payment_succeeded",
    );
    expect(await getCredits(OWNER)).toEqual({ remaining: 10, allowed: 10 });
  });

  it("fulfills an existing pending purchase only once under concurrent events", async () => {
    await getDbExec().execute({
      sql: "INSERT INTO app.purchases (id, owner_id, stripe_checkout_session_id, pack_id, credits, status) VALUES ($1, $2, $3, 'credits-10', 10, 'pending')",
      args: [randomUUID(), OWNER, sessionId],
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        grantPurchasedCredits({
          eventId: `evt_billing_concurrent_${index}`,
          eventType: "checkout.session.completed",
          ownerId: OWNER,
          checkoutSessionId: sessionId,
          packId: "credits-10",
          credits: 10,
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await getCredits(OWNER)).toEqual({ remaining: 10, allowed: 10 });
  });

  it("rejects invalid signatures and ignores unpaid checkouts", async () => {
    expect(
      (await webhook("evt_billing_invalid", undefined, true, false)).status,
    ).toBe(400);
    expect((await webhook("evt_billing_unpaid", undefined, false)).status).toBe(
      200,
    );
    expect(await getCredits(OWNER)).toEqual({ remaining: 0, allowed: 0 });
  });

  it("requires a verified email before checkout", async () => {
    fixtures.getSession.mockResolvedValue({
      user: {
        id: OWNER,
        email: "buyer@example.com",
        isAnonymous: false,
        emailVerified: false,
      },
    });
    const response = await checkoutAction(
      requestArgs(
        new Request("https://billing.example/api/billing/checkout", {
          method: "POST",
        }),
      ),
    );
    expect(response.status).toBe(401);
    expect(getStripe().checkout.sessions.create).not.toHaveBeenCalled();
  });
});
