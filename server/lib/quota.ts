import { randomUUID } from "node:crypto";
import { getDbExec } from "../db/index.js";

export interface Credits {
  remaining: number;
  allowed: number;
}

interface WalletRow {
  balance: number | bigint;
  lifetime_purchased: number | bigint;
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

async function ensureWallet(ownerId: string) {
  await getDbExec().execute({
    sql: `INSERT INTO credit_wallets (owner_id, balance, lifetime_purchased)
          VALUES (?, 0, 0)
          ON CONFLICT(owner_id) DO NOTHING`,
    args: [ownerId],
  });
}

export async function getCredits(ownerId: string): Promise<Credits> {
  await ensureWallet(ownerId);
  const result = await getDbExec().execute({
    sql: "SELECT balance, lifetime_purchased FROM credit_wallets WHERE owner_id = ?",
    args: [ownerId],
  });
  const row = result.rows[0] as unknown as WalletRow | undefined;
  if (!row) throw new Error("credit wallet missing after creation");
  return {
    remaining: toNumber(row.balance),
    allowed: toNumber(row.lifetime_purchased),
  };
}

export interface DecrementResult {
  ok: boolean;
  remaining: number;
  operationId: string;
}

export async function decrementCredits(
  ownerId: string,
  operationId: string = randomUUID(),
  kind = "ai-operation",
): Promise<DecrementResult> {
  await ensureWallet(ownerId);
  const db = getDbExec();
  const transaction = await db.transaction("write");
  try {
    const existing = await transaction.execute({
      sql: "SELECT status FROM credit_operations WHERE operation_id = ? AND owner_id = ?",
      args: [operationId, ownerId],
    });
    if (existing.rows.length > 0) {
      await transaction.commit();
      const credits = await getCredits(ownerId);
      const status = String(existing.rows[0]?.status ?? "");
      return {
        ok: status === "reserved" || status === "committed",
        remaining: credits.remaining,
        operationId,
      };
    }

    const debited = await transaction.execute({
      sql: `UPDATE credit_wallets
            SET balance = balance - 1, updated_at = datetime('now')
            WHERE owner_id = ? AND balance > 0`,
      args: [ownerId],
    });
    if (Number(debited.rowsAffected ?? 0) === 0) {
      await transaction.execute({
        sql: `INSERT INTO credit_operations (operation_id, owner_id, kind, status)
              VALUES (?, ?, ?, 'rejected')`,
        args: [operationId, ownerId, kind],
      });
      await transaction.commit();
      return { ok: false, remaining: 0, operationId };
    }

    await transaction.batch([
      {
        sql: `INSERT INTO credit_operations (operation_id, owner_id, kind, status)
              VALUES (?, ?, ?, 'reserved')`,
        args: [operationId, ownerId, kind],
      },
      {
        sql: `INSERT INTO credit_ledger (id, owner_id, delta, kind, reference_id)
              VALUES (?, ?, -1, 'spend', ?)`,
        args: [randomUUID(), ownerId, `spend:${operationId}`],
      },
    ]);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback();
    throw error;
  }

  const credits = await getCredits(ownerId);
  return { ok: true, remaining: credits.remaining, operationId };
}

export async function commitCredit(operationId: string): Promise<void> {
  await getDbExec().execute({
    sql: `UPDATE credit_operations
          SET status = 'committed', updated_at = datetime('now')
          WHERE operation_id = ? AND status = 'reserved'`,
    args: [operationId],
  });
}

export async function refundCredit(
  ownerId: string,
  operationId: string,
): Promise<void> {
  const db = getDbExec();
  const transaction = await db.transaction("write");
  try {
    const changed = await transaction.execute({
      sql: `UPDATE credit_operations
            SET status = 'refunded', updated_at = datetime('now')
            WHERE operation_id = ? AND owner_id = ? AND status = 'reserved'`,
      args: [operationId, ownerId],
    });
    if (Number(changed.rowsAffected ?? 0) === 0) {
      await transaction.commit();
      return;
    }

    await transaction.batch([
      {
        sql: `UPDATE credit_wallets
              SET balance = balance + 1, updated_at = datetime('now')
              WHERE owner_id = ?`,
        args: [ownerId],
      },
      {
        sql: `INSERT INTO credit_ledger (id, owner_id, delta, kind, reference_id)
              VALUES (?, ?, 1, 'refund', ?)`,
        args: [randomUUID(), ownerId, `refund:${operationId}`],
      },
    ]);
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback();
    throw error;
  }
}

export interface PurchasedCreditsInput {
  eventId: string;
  eventType: string;
  ownerId: string;
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  packId: string;
  credits: number;
  amountTotal?: number | null;
  currency?: string | null;
}

export async function grantPurchasedCredits(
  input: PurchasedCreditsInput,
): Promise<boolean> {
  await ensureWallet(input.ownerId);
  const db = getDbExec();

  try {
    await db.batch(
      [
        {
          sql: "INSERT INTO stripe_events (event_id, event_type) VALUES (?, ?)",
          args: [input.eventId, input.eventType],
        },
        {
          sql: `INSERT INTO purchases (
                  id, owner_id, stripe_checkout_session_id,
                  stripe_payment_intent_id, pack_id, credits,
                  amount_total, currency, status, fulfilled_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'fulfilled', datetime('now'))
                ON CONFLICT(stripe_checkout_session_id) DO UPDATE SET
                  status = 'fulfilled', fulfilled_at = datetime('now')`,
          args: [
            randomUUID(),
            input.ownerId,
            input.checkoutSessionId,
            input.paymentIntentId ?? null,
            input.packId,
            input.credits,
            input.amountTotal ?? null,
            input.currency ?? null,
          ],
        },
        {
          sql: `UPDATE credit_wallets
                SET balance = balance + ?,
                    lifetime_purchased = lifetime_purchased + ?,
                    updated_at = datetime('now')
                WHERE owner_id = ?`,
          args: [input.credits, input.credits, input.ownerId],
        },
        {
          sql: `INSERT INTO credit_ledger (
                  id, owner_id, delta, kind, reference_id, metadata_json
                ) VALUES (?, ?, ?, 'purchase', ?, ?)`,
          args: [
            randomUUID(),
            input.ownerId,
            input.credits,
            `stripe:${input.checkoutSessionId}`,
            JSON.stringify({ packId: input.packId, eventId: input.eventId }),
          ],
        },
      ],
      "write",
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|constraint/i.test(message)) return false;
    throw error;
  }
}
