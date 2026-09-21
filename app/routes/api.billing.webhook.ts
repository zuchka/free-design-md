import type { Route } from "./+types/api.billing.webhook";
import type Stripe from "stripe";
import { grantPurchasedCredits } from "../../server/lib/quota.js";
import { getCreditPack, getStripe } from "../../server/lib/stripe.js";

export async function action({ request }: Route.ActionArgs) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid webhook." },
      { status: 400 },
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const checkout = event.data.object;
    if (checkout.payment_status === "paid") {
      const ownerId = checkout.metadata?.ownerId;
      const packId = checkout.metadata?.packId;
      const pack = packId ? getCreditPack(packId) : null;
      if (!ownerId || !pack) {
        return Response.json({ error: "Checkout metadata is invalid." }, { status: 400 });
      }

      const paymentIntentId =
        typeof checkout.payment_intent === "string"
          ? checkout.payment_intent
          : checkout.payment_intent?.id;
      await grantPurchasedCredits({
        eventId: event.id,
        eventType: event.type,
        ownerId,
        checkoutSessionId: checkout.id,
        paymentIntentId,
        packId: pack.id,
        credits: pack.credits,
        amountTotal: checkout.amount_total,
        currency: checkout.currency,
      });
    }
  }

  return Response.json({ received: true });
}
