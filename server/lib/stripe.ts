import Stripe from "stripe";
import { AI_RUN_PACK, SINGLE_AI_RUN_PACK } from "../../shared/billing.js";

export const CREDIT_PACKS = {
  [SINGLE_AI_RUN_PACK.id]: {
    id: SINGLE_AI_RUN_PACK.id,
    name: SINGLE_AI_RUN_PACK.name,
    credits: SINGLE_AI_RUN_PACK.runs,
    priceId: process.env.STRIPE_PRICE_1_CREDIT ?? "",
  },
  [AI_RUN_PACK.id]: {
    id: AI_RUN_PACK.id,
    name: AI_RUN_PACK.name,
    credits: AI_RUN_PACK.runs,
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
