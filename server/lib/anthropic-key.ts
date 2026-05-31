import type { H3Event } from "h3";
import { getBYOKeyForEvent } from "./byo-key.js";

export type AnthropicKeySource = "byo" | "server";

export interface ResolvedAnthropicKey {
  apiKey: string;
  source: AnthropicKeySource;
  consumesQuota: boolean;
}

/**
 * Decides which Anthropic key a request uses, and whether that consumes quota.
 *
 * Order:
 *   1. BYO key stored for this visitor (via fdmd_anon cookie) → source "byo", no quota.
 *   2. process.env.ANTHROPIC_API_KEY → source "server", consumes quota.
 *   3. Neither → throw "no_api_key_available".
 */
export async function resolveAnthropicKey(
  event: H3Event,
): Promise<ResolvedAnthropicKey> {
  const byo = await getBYOKeyForEvent(event);
  if (byo) {
    return { apiKey: byo, source: "byo", consumesQuota: false };
  }
  const server = process.env.ANTHROPIC_API_KEY;
  if (server) {
    return { apiKey: server, source: "server", consumesQuota: true };
  }
  throw new Error("no_api_key_available");
}
