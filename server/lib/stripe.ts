import Stripe from "stripe";

export const CREDIT_PACKS = {
  "credits-10": {
    id: "credits-10",
    name: "10 AI extractions",
    credits: 10,
    priceId: process.env.STRIPE_PRICE_10_CREDITS ?? "",
  },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getCreditPack(packId: string) {
  return CREDIT_PACKS[packId as CreditPackId] ?? null;
}
