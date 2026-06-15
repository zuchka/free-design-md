import {
  defineEventHandler,
  getHeader,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import {
  enrichStream,
  type EnrichInput,
} from "../../../actions/enrich-design-md.js";
import {
  containsRequestAnthropicApiKey,
  resolveAnthropicKey,
} from "../../lib/anthropic-key.js";
import { resolveConnectedBuilderOwner } from "../../lib/builder-connection.js";
import { isAnonymousOwner, resolveAgentContextOwner } from "../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../lib/quota.js";
import { saveEnrichmentSnapshot } from "../../lib/saved-enrichments.js";
import { createSseSender } from "../../lib/sse.js";

/**
 * POST /api/enrich-design-md (SSE)
 *
 * Gated: hosted calls use the deployment's server key and quota rules.
 * Self-hosted calls may use ANTHROPIC_API_KEY from the deployment environment
 * without Builder Connect or quota.
 *
 * Body: JSON payload from a prior /api/extract?format=json call.
 * Response: text/event-stream with delta/done/error events.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return "POST a JSON body with the extract payload";
  }

  const {
    url,
    designSystemData,
    signals,
    screenshotDataUrl,
    deterministicMarkdown,
    markdown,
  } = body as Record<string, unknown>;

  const md =
    typeof deterministicMarkdown === "string"
      ? deterministicMarkdown
      : typeof markdown === "string"
        ? markdown
        : "";

  if (
    typeof url !== "string" ||
    !url ||
    !designSystemData ||
    !signals ||
    typeof screenshotDataUrl !== "string" ||
    !md
  ) {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return "missing one of: url, designSystemData, signals, screenshotDataUrl, deterministicMarkdown/markdown";
  }

  const owner = await resolveAgentContextOwner(event);
  const bodyRecord = body as Record<string, unknown>;

  if (
    containsRequestAnthropicApiKey(
      bodyRecord,
      getHeader(event, "x-anthropic-api-key"),
    )
  ) {
    setResponseStatus(event, 400);
    return {
      error: "user_keys_not_accepted",
      reason:
        "Hosted API calls do not accept Anthropic keys. Use Free design.md credits or run a local/self-hosted deployment with ANTHROPIC_API_KEY.",
    };
  }

  let resolvedKey: { apiKey: string; source: string; consumesQuota: boolean };
  try {
    resolvedKey = await resolveAnthropicKey(event);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("self_hosted_anthropic_key_missing")
    ) {
      setResponseStatus(event, 503);
      return {
        error: "self_hosted_anthropic_key_missing",
        reason: "Set ANTHROPIC_API_KEY on this self-hosted deployment.",
      };
    }
    setResponseStatus(event, 402);
    return { error: "no_api_key_available", reason: "server-key-required" };
  }

  let quotaOwner = owner;
  let connectedBuilderOwner: Awaited<
    ReturnType<typeof resolveConnectedBuilderOwner>
  > | null = null;

  // Hosted anonymous callers may use the server key only after Builder Connect has
  // stored a complete credential bundle under this browser's fdmd_anon owner.
  if (isAnonymousOwner(owner) && resolvedKey.consumesQuota) {
    connectedBuilderOwner = await resolveConnectedBuilderOwner(owner);
    if (!connectedBuilderOwner) {
      setResponseStatus(event, 401);
      return {
        error: "sign_in_required",
        reason: "connect Builder to use hosted AI credits",
      };
    }
    quotaOwner = connectedBuilderOwner.ownerId;
  }

  let dec: { ok: boolean; remaining: number } | null = null;
  if (resolvedKey.consumesQuota) {
    dec = await decrementCredits(quotaOwner);
    if (!dec.ok) {
      setResponseStatus(event, 402);
      return {
        error: "out_of_credits",
        reason: "signed-in-and-out-of-credits",
      };
    }
  }

  const inputWithKey: EnrichInput = {
    url,
    designSystemData,
    signals,
    screenshotDataUrl,
    deterministicMarkdown: md,
  };

  setResponseHeader(event, "Content-Type", "text/event-stream; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "no-cache, no-transform");
  setResponseHeader(event, "Connection", "keep-alive");
  setResponseHeader(event, "X-Accel-Buffering", "no");

  let sse: ReturnType<typeof createSseSender> | null = null;
  return new ReadableStream({
    async start(controller) {
      sse = createSseSender(controller);

      try {
        for await (const ev of enrichStream(inputWithKey)) {
          if (ev.type === "delta") {
            sse.send("delta", { text: ev.text });
          } else {
            const { type: _drop, ...result } = ev;
            let saveResult:
              | { savedDesignId: string; savedDesignUrl: string }
              | { saveError: string }
              | null = null;
            try {
              const connected =
                connectedBuilderOwner ??
                (await resolveConnectedBuilderOwner(owner));
              if (connected) {
                const saved = await saveEnrichmentSnapshot({
                  owner: connected,
                  sourceUrl: url,
                  deterministicMarkdown: md,
                  enrichedMarkdown: result.markdown,
                  designSystemData,
                  signals,
                  screenshotDataUrl,
                  model: result.model,
                  usage: result.usage,
                  stopReason: result.stopReason,
                });
                saveResult = {
                  savedDesignId: saved.id,
                  savedDesignUrl: saved.url,
                };
              }
            } catch (saveErr) {
              saveResult = {
                saveError:
                  saveErr instanceof Error ? saveErr.message : String(saveErr),
              };
            }
            sse.send("done", { ...result, ...(saveResult ?? {}) });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (resolvedKey.consumesQuota && dec?.ok) {
          await refundCredit(quotaOwner).catch(() => {});
        }
        sse.send("error", { message });
      } finally {
        sse.stop();
        sse.close();
      }
    },
    cancel() {
      sse?.stop();
    },
  });
});
