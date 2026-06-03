import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import {
  enrichStream,
  type EnrichInput,
} from "../../../actions/enrich-design-md.js";
import { resolveAnthropicKey } from "../../lib/anthropic-key.js";
import { resolveConnectedBuilderOwner } from "../../lib/builder-connection.js";
import { resolveOwner, ANONYMOUS_OWNER } from "../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../lib/quota.js";
import { saveEnrichmentSnapshot } from "../../lib/saved-enrichments.js";
import { createSseSender } from "../../lib/sse.js";

/**
 * POST /api/enrich-design-md (SSE)
 *
 * Gated: anonymous callers must have a BYO Anthropic key (stored via the
 * fdmd_anon cookie). Signed-in users (Builder SSO) may use the server key
 * against their quota. Returns 401 otherwise.
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

  const owner = await resolveOwner(event);

  let resolvedKey: { apiKey: string; source: string; consumesQuota: boolean };
  try {
    resolvedKey = await resolveAnthropicKey(event);
  } catch {
    setResponseStatus(event, 402);
    return { error: "no_api_key_available", reason: "byo-key-required" };
  }

  let quotaOwner = owner;
  let connectedBuilderOwner:
    | Awaited<ReturnType<typeof resolveConnectedBuilderOwner>>
    | null = null;

  // Anonymous callers may use the server key only after Builder Connect has
  // stored a complete credential bundle. Builder Connect does not create an app
  // session, so resolveOwner() still returns ANONYMOUS_OWNER in production.
  if (owner === ANONYMOUS_OWNER && resolvedKey.source !== "byo") {
    connectedBuilderOwner = await resolveConnectedBuilderOwner(owner);
    if (!connectedBuilderOwner) {
      setResponseStatus(event, 401);
      return {
        error: "sign_in_required",
        reason: "add a BYO key or sign in with Builder",
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
    anthropicApiKey: resolvedKey.apiKey,
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
