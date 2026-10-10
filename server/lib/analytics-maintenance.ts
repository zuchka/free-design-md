import { getDbExec, type DbExecutor } from "../db/client.js";
import { accountIdentity } from "./analytics-identity.js";
import { analyticsEnabled, analyticsWrite } from "./analytics-db.js";

/** Idempotent projection; accounting always remains in the original billing tables. */
export async function projectPurchases(db: DbExecutor, checkoutId?: string) {
  // A ledger projection must not manufacture a visitor or bypass opt-out.
  const result = await db.execute({
    sql: `WITH pending AS (
    SELECT p.* FROM app.purchases p WHERE p.status='fulfilled'
      AND p.fulfilled_at::timestamp AT TIME ZONE 'UTC'>=now()-interval '13 months'
      AND ($1::text IS NULL OR p.stripe_checkout_session_id=$1)
      AND NOT EXISTS(SELECT 1 FROM app.analytics_events WHERE deduplication_key='purchase:'||p.stripe_checkout_session_id)
      ORDER BY p.fulfilled_at LIMIT 500
  ) INSERT INTO app.analytics_events(id,deduplication_key,name,source,audience,trust,auth_state,operation_id,occurred_at,properties)
    SELECT gen_random_uuid(),'purchase:'||stripe_checkout_session_id,'purchase_fulfilled','historical','unknown','billing','verified',
      stripe_checkout_session_id,fulfilled_at::timestamp AT TIME ZONE 'UTC','{"projection":"billing"}'::jsonb FROM pending ON CONFLICT DO NOTHING`,
    args: [checkoutId || null],
  });
  return result.rowsAffected;
}
export async function projectPurchase(checkoutId: string) {
  await analyticsWrite((db) => projectPurchases(db, checkoutId));
}
export async function maintainAnalytics(db: DbExecutor = getDbExec()) {
  if (!analyticsEnabled()) return { enabled: false };
  const links = await db.execute<{
    anonymous_user_id: string;
    verified_user_id: string;
  }>(
    `SELECT anonymous_user_id,verified_user_id FROM app.analytics_link_intents ORDER BY created_at LIMIT 500`,
  );
  for (const link of links.rows)
    await db.transaction(async (tx) => {
      const account = await accountIdentity(tx, link.verified_user_id);
      await tx.execute({
        sql: `UPDATE app.analytics_identities i SET canonical_id=$2 WHERE i.kind='anonymous' AND i.canonical_id IS NULL
      AND EXISTS(SELECT 1 FROM app.analytics_visitors v WHERE v.identity_id=i.id AND v.anonymous_user_id=$1)`,
        args: [link.anonymous_user_id, account],
      });
      await tx.execute({
        sql: `UPDATE app.analytics_identities SET first_seen_at=least(first_seen_at,(SELECT min(first_seen_at) FROM app.analytics_identities WHERE canonical_id=$1)), first_visited_at=least(first_visited_at,(SELECT min(first_visited_at) FROM app.analytics_identities WHERE canonical_id=$1)), first_active_at=least(first_active_at,(SELECT min(first_active_at) FROM app.analytics_identities WHERE canonical_id=$1)) WHERE id=$1`,
        args: [account],
      });
      await tx.execute({
        sql: `DELETE FROM app.analytics_link_intents WHERE anonymous_user_id=$1`,
        args: [link.anonymous_user_id],
      });
    });
  const purchases = await projectPurchases(db);
  const ai = await db.execute(`WITH pending AS (
    SELECT o.* FROM app.credit_operations o WHERE o.status='committed'
      AND o.updated_at::timestamp AT TIME ZONE 'UTC'<now()-interval '5 minutes'
      AND o.updated_at::timestamp AT TIME ZONE 'UTC'>=now()-interval '13 months'
      AND NOT EXISTS(SELECT 1 FROM app.analytics_events WHERE deduplication_key='ai:'||o.operation_id||':completed')
      ORDER BY o.updated_at LIMIT 500
  ) INSERT INTO app.analytics_events(id,deduplication_key,name,source,audience,trust,auth_state,operation_id,occurred_at,properties)
    SELECT gen_random_uuid(),'ai:'||operation_id||':completed','ai_succeeded','historical','unknown','billing','verified',
      operation_id,updated_at::timestamp AT TIME ZONE 'UTC',jsonb_build_object('route',kind,'projection','billing') FROM pending ON CONFLICT DO NOTHING`);
  const expired = await db.execute(
    `DELETE FROM app.analytics_events WHERE id IN (SELECT id FROM app.analytics_events WHERE occurred_at<now()-interval '13 months' ORDER BY occurred_at LIMIT 5000)`,
  );
  const visitors = await db.execute(
    `DELETE FROM app.analytics_visitors WHERE digest IN (SELECT digest FROM app.analytics_visitors WHERE expires_at<now() ORDER BY expires_at LIMIT 5000)`,
  );
  // Delete leaves first; a subsequent pass can remove their now-unreferenced canonical identities.
  const identities =
    await db.execute(`DELETE FROM app.analytics_identities i WHERE i.id IN (
    SELECT c.id FROM app.analytics_identities c WHERE c.first_seen_at<now()-interval '13 months'
      AND NOT EXISTS(SELECT 1 FROM app.analytics_events e WHERE e.identity_id=c.id)
      AND NOT EXISTS(SELECT 1 FROM app.analytics_visitors v WHERE v.identity_id=c.id)
      AND NOT EXISTS(SELECT 1 FROM app.analytics_identities a WHERE a.canonical_id=c.id) LIMIT 5000)`);
  await db.execute(
    `UPDATE app.analytics_state SET last_maintenance_at=now() WHERE id`,
  );
  return {
    enabled: true,
    links: links.rows.length,
    purchases,
    ai: ai.rowsAffected,
    expired: expired.rowsAffected,
    visitors: visitors.rowsAffected,
    identities: identities.rowsAffected,
    more:
      links.rows.length === 500 ||
      purchases === 500 ||
      ai.rowsAffected === 500 ||
      expired.rowsAffected === 5000 ||
      visitors.rowsAffected === 5000 ||
      identities.rowsAffected > 0,
  };
}
