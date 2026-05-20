import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export const QUOTA_DEFAULT = 3;
export const QUOTA_BUILDER_BONUS = 10;

export async function ensureQuota(principal: string): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.fdmdQuota)
    .values({ userId: principal, enrichCount: 0, bonusCredits: 0 })
    .onConflictDoNothing({ target: schema.fdmdQuota.userId });
}

export async function quotaRemaining(principal: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      enrichCount: schema.fdmdQuota.enrichCount,
      bonusCredits: schema.fdmdQuota.bonusCredits,
    })
    .from(schema.fdmdQuota)
    .where(eq(schema.fdmdQuota.userId, principal))
    .limit(1);
  const used = rows[0]?.enrichCount ?? 0;
  const bonus = rows[0]?.bonusCredits ?? 0;
  return Math.max(0, QUOTA_DEFAULT + bonus - used);
}

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
      sql`${schema.fdmdQuota.userId} = ${principal} AND ${schema.fdmdQuota.enrichCount} < (${QUOTA_DEFAULT} + ${schema.fdmdQuota.bonusCredits})`,
    )
    .returning({
      enrichCount: schema.fdmdQuota.enrichCount,
      bonusCredits: schema.fdmdQuota.bonusCredits,
    });

  if (result.length === 0) {
    return { ok: false, remaining: 0 };
  }
  const { enrichCount, bonusCredits } = result[0];
  return {
    ok: true,
    remaining: Math.max(0, QUOTA_DEFAULT + bonusCredits - enrichCount),
  };
}

export async function applyBuilderKeyBonus(
  principal: string,
  apiKey: string,
): Promise<{ ok: boolean; reason?: string; remaining?: number }> {
  // Verify the key is a live Builder.io space
  let valid = false;
  try {
    const res = await fetch(
      `https://cdn.builder.io/api/v1/content/page?apiKey=${encodeURIComponent(apiKey)}&limit=1`,
    );
    valid = res.ok;
  } catch {
    return { ok: false, reason: "verification_failed" };
  }

  if (!valid) {
    return { ok: false, reason: "invalid_key" };
  }

  const db = getDb();

  // Reject if this key was already used by anyone
  const existingKey = await db
    .select({ userId: schema.fdmdBuilderKeys.userId })
    .from(schema.fdmdBuilderKeys)
    .where(eq(schema.fdmdBuilderKeys.apiKey, apiKey))
    .limit(1);

  if (existingKey.length > 0) {
    return { ok: false, reason: "key_already_used" };
  }

  // Reject if this user has already submitted any key
  const existingUserKey = await db
    .select({ apiKey: schema.fdmdBuilderKeys.apiKey })
    .from(schema.fdmdBuilderKeys)
    .where(eq(schema.fdmdBuilderKeys.userId, principal))
    .limit(1);

  if (existingUserKey.length > 0) {
    return { ok: false, reason: "already_unlocked" };
  }

  await ensureQuota(principal);

  // Write the key record first; catch constraint violation from concurrent same-key submissions
  try {
    await db
      .insert(schema.fdmdBuilderKeys)
      .values({ apiKey, userId: principal });
  } catch {
    return { ok: false, reason: "key_already_used" };
  }

  await db
    .update(schema.fdmdQuota)
    .set({
      bonusCredits: QUOTA_BUILDER_BONUS,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(eq(schema.fdmdQuota.userId, principal));

  const remaining = await quotaRemaining(principal);
  return { ok: true, remaining };
}
