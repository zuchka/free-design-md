import { resetMetricsDatabase } from "./metrics-test-database.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDbExec, resetDbClientForTests } from "../db/client.js";
import { renderBillingMetrics } from "./billing-metrics.js";
import {
  commitCredit,
  decrementCredits,
  grantPurchasedCredits,
  refundCredit,
} from "./quota.js";
import {
  metricsStartedAt,
  recordEnrichRequest,
  renderPrometheusMetrics,
  resetInMemoryMetricsForTests,
} from "./metrics.js";

const purchase = {
  eventId: "evt_metrics",
  eventType: "checkout.session.completed",
  ownerId: "private-user",
  checkoutSessionId: "cs_metrics",
  packId: "credits-10",
  credits: 10,
};

beforeEach(async () => {
  await resetMetricsDatabase();
  vi.stubEnv("DATABASE_TESTS", "true");
  await resetDbClientForTests();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await resetDbClientForTests();
  vi.unstubAllEnvs();
});

describe("billing metrics from durable records", () => {
  it("keeps paid AI outcomes after process memory is reset", async () => {
    await recordEnrichRequest({
      status: "success",
      keySource: "hosted_server",
      quota: "consumed",
      startedAt: metricsStartedAt(),
    });
    resetInMemoryMetricsForTests();
    const output = await renderPrometheusMetrics();
    expect(output).toContain("fdmd_persistent_metrics_available 1");
    expect(output).toContain(
      'fdmd_ai_requests_total{route="enrich",status="success",key_source="hosted_server",credit_outcome="consumed"} 1',
    );
  });
  it("counts fulfilled packs and granted credits once across event/session retries and memory resets", async () => {
    await getDbExec().execute({
      sql: "INSERT INTO app.purchases (id, owner_id, stripe_checkout_session_id, pack_id, credits, status) VALUES ('pending', $1, $2, $3, $4, 'pending')",
      args: [
        purchase.ownerId,
        purchase.checkoutSessionId,
        purchase.packId,
        purchase.credits,
      ],
    });
    expect(await renderBillingMetrics()).toContain(
      'fdmd_credit_purchases_total{pack="credits-10"} 0',
    );
    expect(await grantPurchasedCredits(purchase)).toBe(true);
    expect(await grantPurchasedCredits(purchase)).toBe(false);
    expect(
      await grantPurchasedCredits({
        ...purchase,
        eventId: "evt_metrics_async",
        eventType: "checkout.session.async_payment_succeeded",
      }),
    ).toBe(false);
    await grantPurchasedCredits({
      ...purchase,
      eventId: "evt_metrics_single",
      checkoutSessionId: "cs_single",
      packId: "credits-1",
      credits: 1,
    });
    resetInMemoryMetricsForTests();
    const output = await renderBillingMetrics();
    expect(output).toContain(
      'fdmd_credit_purchases_total{pack="credits-10"} 1',
    );
    expect(output).toContain('fdmd_credit_purchases_total{pack="credits-1"} 1');
    expect(output).toContain(
      'fdmd_credits_purchased_total{pack="credits-10"} 10',
    );
    expect(output).toContain(
      'fdmd_credits_purchased_total{pack="credits-1"} 1',
    );
    expect(output).toContain("fdmd_credit_wallet_balance 11");
    expect(output).not.toMatch(/private-user|cs_metrics|evt_metrics/);
  });

  it("separates cumulative reservations from commits, refunds, pending and rejected credits", async () => {
    await grantPurchasedCredits(purchase);
    await decrementCredits(purchase.ownerId, "op-commit", "enrich");
    await decrementCredits(purchase.ownerId, "op-commit", "enrich");
    await commitCredit("op-commit");
    await commitCredit("op-commit");
    await refundCredit(purchase.ownerId, "op-commit");
    await decrementCredits(purchase.ownerId, "op-refund", "iterate");
    await refundCredit(purchase.ownerId, "op-refund");
    await refundCredit(purchase.ownerId, "op-refund");
    await decrementCredits(purchase.ownerId, "op-pending", "saved-iterate");
    await decrementCredits("empty-user", "op-rejected", "enrich");
    await decrementCredits("empty-user", "op-rejected", "enrich");
    const output = await renderBillingMetrics();
    expect(output).toContain(
      'fdmd_credit_operations_total{route="enrich",event="reserved"} 1',
    );
    expect(output).toContain(
      'fdmd_credit_operations_total{route="enrich",event="committed"} 1',
    );
    expect(output).toContain(
      'fdmd_credit_operations_total{route="enrich",event="refunded"} 0',
    );
    expect(output).toContain(
      'fdmd_credit_operations_total{route="enrich",event="rejected"} 1',
    );
    expect(output).toContain(
      'fdmd_credit_operations_total{route="iterate",event="reserved"} 1',
    );
    expect(output).toContain(
      'fdmd_credit_operations_total{route="iterate",event="refunded"} 1',
    );
    expect(output).toContain(
      'fdmd_credit_reservations_pending{route="saved_iterate"} 1',
    );
    expect(output).toContain(
      'fdmd_credit_reservations_pending{route="enrich"} 0',
    );
    expect(output).toContain("fdmd_credit_wallet_balance 8");
  });

  it("uses a bounded fallback for unknown stored labels", async () => {
    await grantPurchasedCredits({ ...purchase, packId: 'private-pack"\\n' });
    await grantPurchasedCredits({
      ...purchase,
      eventId: "evt_other",
      checkoutSessionId: "cs_other",
      packId: "another-pack",
    });
    await decrementCredits(purchase.ownerId, "op-custom", "private-kind");
    const output = await renderBillingMetrics();
    expect(output).toContain('fdmd_credit_purchases_total{pack="other"} 2');
    expect(output).toContain(
      'fdmd_credit_operations_total{route="other",event="reserved"} 1',
    );
    expect(output).not.toMatch(/private-pack|another-pack|private-kind/);
  });

  it("exposes collection failure without substituting zero business totals", async () => {
    vi.spyOn(getDbExec(), "execute").mockRejectedValueOnce(
      new Error("unavailable"),
    );
    const output = await renderBillingMetrics();
    expect(output).toContain("fdmd_billing_metrics_available 0");
    expect(output).not.toContain("fdmd_credit_purchases_total");
    expect(output).not.toContain("fdmd_credit_wallet_balance");
  });
});
