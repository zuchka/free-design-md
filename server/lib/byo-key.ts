import type { H3Event } from "h3";
import { getCookie } from "h3";
import { getDbExec } from "@agent-native/core/db";
import { FDMD_ANON_COOKIE } from "./cookie-names";

/**
 * Legacy helper for the disabled hosted BYO-key flow.
 *
 * Returns the BYO Anthropic API key for the visitor identified by their
 * `fdmd_anon` cookie, or null if none is stored.
 */
export async function getBYOKeyForEvent(
  event: H3Event,
): Promise<string | null> {
  const token = getCookie(event, FDMD_ANON_COOKIE);
  if (!token) return null;
  const exec = getDbExec();
  const r = await exec.execute({
    sql: `SELECT api_key FROM fdmd_byo_keys WHERE token = ?`,
    args: [token],
  });
  const row = r.rows[0] as { api_key: string } | undefined;
  return row?.api_key ?? null;
}

/**
 * Legacy helper for the disabled hosted BYO-key flow.
 *
 * Stores or updates the BYO Anthropic API key for the current visitor.
 * No-op if the visitor has no `fdmd_anon` cookie.
 */
export async function setBYOKeyForEvent(
  event: H3Event,
  apiKey: string,
): Promise<void> {
  const token = getCookie(event, FDMD_ANON_COOKIE);
  if (!token) return;
  const exec = getDbExec();
  await exec.execute({
    sql: `INSERT INTO fdmd_byo_keys (token, api_key)
          VALUES (?, ?)
          ON CONFLICT(token) DO UPDATE SET api_key = excluded.api_key`,
    args: [token, apiKey],
  });
}
