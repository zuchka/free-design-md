import { getDbExec } from "@agent-native/core/db";

export const DEFAULT_ALLOWED_CREDITS = 3;
export const SHARE_PROMO_BONUS_CREDITS = 3;
export const SHARE_PROMO_CAMPAIGN = "share-v1";

export interface Credits {
  remaining: number;
  allowed: number;
}

interface QuotaRow {
  enrich_count: number | bigint;
  bonus_credits: number | bigint;
}

function toNum(v: number | bigint): number {
  return typeof v === "bigint" ? Number(v) : v;
}

export async function getCredits(owner: string): Promise<Credits> {
  const exec = getDbExec();
  // Upsert: seed a fresh row with the default allowed credits if missing.
  await exec.execute({
    sql: `INSERT INTO fdmd_quota (user_id, enrich_count, bonus_credits)
          VALUES (?, 0, ?)
          ON CONFLICT(user_id) DO NOTHING`,
    args: [owner, DEFAULT_ALLOWED_CREDITS],
  });

  const r = await exec.execute({
    sql: `SELECT enrich_count, bonus_credits FROM fdmd_quota WHERE user_id = ?`,
    args: [owner],
  });
  const row = r.rows[0] as QuotaRow | undefined;
  if (!row) {
    throw new Error("quota row missing after upsert");
  }
  const allowed = toNum(row.bonus_credits);
  const used = toNum(row.enrich_count);
  return { allowed, remaining: Math.max(0, allowed - used) };
}

export interface DecrementResult {
  ok: boolean;
  remaining: number;
}

export async function decrementCredits(owner: string): Promise<DecrementResult> {
  await getCredits(owner); // ensure row exists
  const exec = getDbExec();

  // Atomic conditional decrement — only succeeds while credits remain.
  const result = await exec.execute({
    sql: `UPDATE fdmd_quota
          SET enrich_count = enrich_count + 1,
              updated_at = datetime('now')
          WHERE user_id = ?
            AND enrich_count < bonus_credits`,
    args: [owner],
  });

  const affected = result.rowsAffected ?? 0;
  if (affected === 0) {
    return { ok: false, remaining: 0 };
  }
  const { remaining } = await getCredits(owner);
  return { ok: true, remaining };
}

export async function refundCredit(owner: string): Promise<void> {
  const exec = getDbExec();
  await exec.execute({
    sql: `UPDATE fdmd_quota
          SET enrich_count = MAX(0, enrich_count - 1),
              updated_at = datetime('now')
          WHERE user_id = ?`,
    args: [owner],
  });
}

export interface CreditPromoStatus {
  campaign: string;
  credits: number;
  claimed: boolean;
}

interface CreditPromoRow {
  credits: number | bigint;
}

export async function getSharePromoStatus(
  owner: string,
): Promise<CreditPromoStatus> {
  await getCredits(owner);
  const exec = getDbExec();
  const result = await exec.execute({
    sql: `SELECT credits
          FROM fdmd_credit_promos
          WHERE owner_id = ? AND campaign = ?`,
    args: [owner, SHARE_PROMO_CAMPAIGN],
  });
  const row = result.rows[0] as CreditPromoRow | undefined;
  return {
    campaign: SHARE_PROMO_CAMPAIGN,
    credits: row ? toNum(row.credits) : SHARE_PROMO_BONUS_CREDITS,
    claimed: Boolean(row),
  };
}

export interface ClaimSharePromoResult {
  claimedNow: boolean;
  promo: CreditPromoStatus;
  credits: Credits;
}

export async function claimSharePromoCredits(
  owner: string,
): Promise<ClaimSharePromoResult> {
  await getCredits(owner);
  const exec = getDbExec();
  const inserted = await exec.execute({
    sql: `INSERT INTO fdmd_credit_promos (owner_id, campaign, credits)
          VALUES (?, ?, ?)
          ON CONFLICT(owner_id, campaign) DO NOTHING`,
    args: [owner, SHARE_PROMO_CAMPAIGN, SHARE_PROMO_BONUS_CREDITS],
  });

  const claimedNow = (inserted.rowsAffected ?? 0) > 0;
  if (claimedNow) {
    await exec.execute({
      sql: `UPDATE fdmd_quota
            SET bonus_credits = bonus_credits + ?,
                updated_at = datetime('now')
            WHERE user_id = ?`,
      args: [SHARE_PROMO_BONUS_CREDITS, owner],
    });
  }

  const credits = await getCredits(owner);
  const promo = await getSharePromoStatus(owner);
  return { claimedNow, promo, credits };
}
