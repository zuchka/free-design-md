import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export const QUOTA_DEFAULT = 3;

export async function ensureQuota(userId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.fdmdQuota)
    .values({ userId, enrichCount: 0 })
    .onConflictDoNothing({ target: schema.fdmdQuota.userId });
}

export async function quotaRemaining(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ enrichCount: schema.fdmdQuota.enrichCount })
    .from(schema.fdmdQuota)
    .where(eq(schema.fdmdQuota.userId, userId))
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
  userId: string,
): Promise<{ ok: boolean; remaining: number }> {
  await ensureQuota(userId);
  const db = getDb();
  const result = await db
    .update(schema.fdmdQuota)
    .set({
      enrichCount: sql`${schema.fdmdQuota.enrichCount} + 1`,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(
      sql`${schema.fdmdQuota.userId} = ${userId} AND ${schema.fdmdQuota.enrichCount} < ${QUOTA_DEFAULT}`,
    )
    .returning({ enrichCount: schema.fdmdQuota.enrichCount });

  if (result.length === 0) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: Math.max(0, QUOTA_DEFAULT - result[0].enrichCount) };
}
