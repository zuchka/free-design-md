import { randomUUID } from "node:crypto";
import { getDbExec } from "../db/index.js";

export interface Credits {
  remaining: number;
  allowed: number;
}

interface WalletRow extends Record<string, unknown> {
  balance: number | bigint;
  lifetime_purchased: number | bigint;
}

interface OperationRow extends Record<string, unknown> {
  status: string;
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

async function ensureWallet(ownerId: string): Promise<void> {
  await getDbExec().execute({
    sql: `INSERT INTO app.credit_wallets (owner_id, balance, lifetime_purchased)
          VALUES ($1, 0, 0)
          ON CONFLICT(owner_id) DO NOTHING`,
    args: [ownerId],
  });
}

export async function getCredits(ownerId: string): Promise<Credits> {
  await ensureWallet(ownerId);
  const result = await getDbExec().execute<WalletRow>({
    sql: `SELECT balance, lifetime_purchased
          FROM app.credit_wallets
          WHERE owner_id = $1`,
    args: [ownerId],
  });
  const row = result.rows[0];
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

  return getDbExec().transaction(async (transaction) => {
    const claimed = await transaction.execute<OperationRow>({
      sql: `INSERT INTO app.credit_operations
              (operation_id, owner_id, kind, status)
            VALUES ($1, $2, $3, 'pending')
            ON CONFLICT(operation_id) DO NOTHING
            RETURNING status`,
      args: [operationId, ownerId, kind],
    });

    if (claimed.rows.length === 0) {
      const existing = await transaction.execute<OperationRow>({
        sql: `SELECT status
              FROM app.credit_operations
              WHERE operation_id = $1 AND owner_id = $2`,
        args: [operationId, ownerId],
      });
      const wallet = await transaction.execute<WalletRow>({
        sql: `SELECT balance, lifetime_purchased
              FROM app.credit_wallets
              WHERE owner_id = $1`,
        args: [ownerId],
      });
      const status = existing.rows[0]?.status ?? "";
      return {
        ok: status === "reserved" || status === "committed",
        remaining: wallet.rows[0] ? toNumber(wallet.rows[0].balance) : 0,
        operationId,
      };
    }

    const debited = await transaction.execute<WalletRow>({
      sql: `UPDATE app.credit_wallets
            SET balance = balance - 1,
                updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
            WHERE owner_id = $1 AND balance > 0
            RETURNING balance, lifetime_purchased`,
      args: [ownerId],
    });

    if (debited.rows.length === 0) {
      await transaction.execute({
        sql: `UPDATE app.credit_operations
              SET status = 'rejected',
                  updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
              WHERE operation_id = $1`,
        args: [operationId],
      });
      return { ok: false, remaining: 0, operationId };
    }

    await transaction.execute({
      sql: `INSERT INTO app.credit_ledger
              (id, owner_id, delta, kind, reference_id)
            VALUES ($1, $2, -1, 'spend', $3)`,
      args: [randomUUID(), ownerId, `spend:${operationId}`],
    });
    await transaction.execute({
      sql: `UPDATE app.credit_operations
            SET status = 'reserved',
                updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
            WHERE operation_id = $1`,
      args: [operationId],
    });

    return {
      ok: true,
      remaining: toNumber(debited.rows[0].balance),
      operationId,
    };
  });
}

export async function commitCredit(operationId: string): Promise<void> {
  await getDbExec().execute({
    sql: `UPDATE app.credit_operations
          SET status = 'committed',
              updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
          WHERE operation_id = $1 AND status = 'reserved'`,
    args: [operationId],
  });
}

export async function refundCredit(
  ownerId: string,
  operationId: string,
): Promise<void> {
  await getDbExec().transaction(async (transaction) => {
    const changed = await transaction.execute({
      sql: `UPDATE app.credit_operations
            SET status = 'refunded',
                updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
            WHERE operation_id = $1 AND owner_id = $2 AND status = 'reserved'
            RETURNING operation_id`,
      args: [operationId, ownerId],
    });
    if (changed.rows.length === 0) return;

    await transaction.execute({
      sql: `UPDATE app.credit_wallets
            SET balance = balance + 1,
                updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
            WHERE owner_id = $1`,
      args: [ownerId],
    });
    await transaction.execute({
      sql: `INSERT INTO app.credit_ledger
              (id, owner_id, delta, kind, reference_id)
            VALUES ($1, $2, 1, 'refund', $3)`,
      args: [randomUUID(), ownerId, `refund:${operationId}`],
    });
  });
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

  return getDbExec().transaction(async (transaction) => {
    const event = await transaction.execute({
      sql: `INSERT INTO app.stripe_events (event_id, event_type)
            VALUES ($1, $2)
            ON CONFLICT(event_id) DO NOTHING
            RETURNING event_id`,
      args: [input.eventId, input.eventType],
    });
    if (event.rows.length === 0) return false;

    const purchase = await transaction.execute({
      sql: `INSERT INTO app.purchases (
              id, owner_id, stripe_checkout_session_id,
              stripe_payment_intent_id, pack_id, credits,
              amount_total, currency, status, fulfilled_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 'fulfilled',
              to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
            )
            ON CONFLICT(stripe_checkout_session_id) DO NOTHING
            RETURNING id`,
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
    });
    if (purchase.rows.length === 0) return false;

    await transaction.execute({
      sql: `UPDATE app.credit_wallets
            SET balance = balance + $1,
                lifetime_purchased = lifetime_purchased + $1,
                updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
            WHERE owner_id = $2`,
      args: [input.credits, input.ownerId],
    });
    await transaction.execute({
      sql: `INSERT INTO app.credit_ledger (
              id, owner_id, delta, kind, reference_id, metadata_json
            ) VALUES ($1, $2, $3, 'purchase', $4, $5)`,
      args: [
        randomUUID(),
        input.ownerId,
        input.credits,
        `stripe:${input.checkoutSessionId}`,
        JSON.stringify({ packId: input.packId, eventId: input.eventId }),
      ],
    });
    return true;
  });
}
