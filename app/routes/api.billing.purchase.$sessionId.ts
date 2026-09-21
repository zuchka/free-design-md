import type { Route } from "./+types/api.billing.purchase.$sessionId";
import { getRequestSession } from "../../server/lib/auth.js";
import { getDbExec } from "../../server/db/index.js";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getRequestSession(request);
  if (!session || session.user.isAnonymous) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  const result = await getDbExec().execute({
    sql: `SELECT status, credits, pack_id
          FROM purchases
          WHERE stripe_checkout_session_id = ? AND owner_id = ?`,
    args: [params.sessionId ?? "", session.user.id],
  });
  const purchase = result.rows[0];
  if (!purchase) return Response.json({ error: "Purchase not found." }, { status: 404 });
  return Response.json({
    status: purchase.status,
    credits: Number(purchase.credits),
    packId: purchase.pack_id,
  });
}
