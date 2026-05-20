import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export const QUOTA_DEFAULT = 3;

/**
 * Callers pass `session.email` as the principal. The framework session
 * sometimes resolves via the legacy `an_session_*` cookie path, which
 * returns `{email, token}` with no `userId` — so email is the only
 * identifier guaranteed to be present across both auth paths. The
 * `fdmd_quota.user_id` column stores whatever stable string the caller
 * passes; today that's the email.
 */
export async function ensureQuota(principal: string): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.fdmdQuota)
    .values({ userId: principal, enrichCount: 0 })
    .onConflictDoNothing({ target: schema.fdmdQuota.userId });
}

export async function quotaRemaining(principal: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ enrichCount: schema.fdmdQuota.enrichCount })
    .from(schema.fdmdQuota)
    .where(eq(schema.fdmdQuota.userId, principal))
    .limit(1);
  const used = rows[0]?.enrichCount ?? 0;
  return Math.max(0, QUOTA_DEFAULT - used);
}

/**
 * Atomically decrement remaining quota.
 *
 * Uses a WHERE-guarded UPDATE so concurrent calls can't push the
 * count past QUOTA_DEFAULT. SQLite serializes writes, so the second
 * caller sees the post-update state. If the user has no row yet,
 * insert one first.
 */
export async function consumeQuota(
  principal: string,
): Promise<{ ok: boolean; remaining: number }> {
  await ensureQuota(principal);
  const db = getDb();
  const result = await db
    .update(schema.fdmdQuota)
    .set({
      enrichCount: sql`${schema.fdmdQuota.enrichCount} + 1`,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(
      sql`${schema.fdmdQuota.userId} = ${principal} AND ${schema.fdmdQuota.enrichCount} < ${QUOTA_DEFAULT}`,
    )
    .returning({ enrichCount: schema.fdmdQuota.enrichCount });

  if (result.length === 0) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: Math.max(0, QUOTA_DEFAULT - result[0].enrichCount) };
}
