import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDbExec, resetDbClientForTests } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { renderBillingMetrics } from "./billing-metrics.js";
import {
  commitCredit,
  decrementCredits,
  grantPurchasedCredits,
  refundCredit,
} from "./quota.js";
import { resetInMemoryMetricsForTests } from "./metrics.js";

const purchase = {
  eventId: "evt_metrics",
  eventType: "checkout.session.completed",
  ownerId: "private-user",
  checkoutSessionId: "cs_metrics",
  packId: "credits-10",
  credits: 10,
};

let databaseDirectory: string;
beforeEach(async () => {
  databaseDirectory = mkdtempSync(join(tmpdir(), "fdmd-metrics-"));
  vi.stubEnv("DATABASE_URL", `file:${join(databaseDirectory, "test.db")}`);
  resetDbClientForTests();
  await migrateDatabase();
});
afterEach(() => {
  vi.restoreAllMocks();
  resetDbClientForTests();
  vi.unstubAllEnvs();
  rmSync(databaseDirectory, { recursive: true, force: true });
});

describe("billing metrics from durable records", () => {
  it("counts fulfilled packs and granted credits once across event/session retries and memory resets", async () => {
    await getDbExec().execute({
      sql: "INSERT INTO purchases (id, owner_id, stripe_checkout_session_id, pack_id, credits, status) VALUES ('pending', ?, ?, ?, ?, 'pending')",
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
    vi.spyOn(getDbExec(), "batch").mockRejectedValueOnce(
      new Error("unavailable"),
    );
    const output = await renderBillingMetrics();
    expect(output).toContain("fdmd_billing_metrics_available 0");
    expect(output).not.toContain("fdmd_credit_purchases_total");
    expect(output).not.toContain("fdmd_credit_wallet_balance");
  });
});
