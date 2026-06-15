import type { H3Event } from "h3";

export type AnthropicKeySource = "self-host" | "server";

export interface ResolvedAnthropicKey {
  apiKey: string;
  source: AnthropicKeySource;
  consumesQuota: boolean;
}

export function isSelfHostedMode(): boolean {
  return process.env.FREE_DESIGN_MD_SELF_HOSTED === "1";
}

export function containsRequestAnthropicApiKey(
  body: Record<string, unknown>,
  headerValue: unknown,
): boolean {
  if (typeof headerValue === "string" && headerValue.trim()) {
    return true;
  }
  return Object.prototype.hasOwnProperty.call(body, "anthropicApiKey");
}

/**
 * Decides which Anthropic key a request uses, and whether that consumes quota.
 *
 * Hosted mode uses the deployment's server key and consumes quota.
 * Self-host mode uses the deployment's server key without quota.
 */
export async function resolveAnthropicKey(
  _event: H3Event,
): Promise<ResolvedAnthropicKey> {
  const server = process.env.ANTHROPIC_API_KEY;
  if (server) {
    const selfHosted = isSelfHostedMode();
    return {
      apiKey: server,
      source: selfHosted ? "self-host" : "server",
      consumesQuota: !selfHosted,
    };
  }

  if (isSelfHostedMode()) {
    throw new Error("self_hosted_anthropic_key_missing");
  }
  throw new Error("no_api_key_available");
}
