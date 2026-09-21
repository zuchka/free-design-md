import type { Route } from "./+types/api.billing.checkout";
import { randomUUID } from "node:crypto";
import { getRequestSession } from "../../server/lib/auth.js";
import { getDbExec } from "../../server/db/index.js";
import { getCreditPack, getStripe } from "../../server/lib/stripe.js";
import { AI_RUN_PACK } from "../../shared/billing.js";

export async function action({ request }: Route.ActionArgs) {
  const session = await getRequestSession(request);
  if (!session || session.user.isAnonymous) {
    return Response.json(
      { error: "Sign in with your email before purchasing AI runs." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { packId?: string };
  const pack = getCreditPack(body.packId ?? AI_RUN_PACK.id);
  if (!pack)
    return Response.json({ error: "Unknown credit pack." }, { status: 400 });
  if (!pack.priceId) {
    return Response.json(
      { error: "Credit purchases are not configured yet." },
      { status: 503 },
    );
  }

  const origin =
    process.env.PUBLIC_ORIGIN ??
    process.env.BETTER_AUTH_URL ??
    new URL(request.url).origin;
  const checkout = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    customer_email: session.user.email,
    line_items: [{ price: pack.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: {
      ownerId: session.user.id,
      packId: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${origin}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?purchase=cancelled`,
  });

  await getDbExec().execute({
    sql: `INSERT INTO purchases (
            id, owner_id, stripe_checkout_session_id, pack_id, credits, status
          ) VALUES (?, ?, ?, ?, ?, 'pending')
          ON CONFLICT(stripe_checkout_session_id) DO NOTHING`,
    args: [randomUUID(), session.user.id, checkout.id, pack.id, pack.credits],
  });

  return Response.json({ url: checkout.url });
}
