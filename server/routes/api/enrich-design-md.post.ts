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
import {
  resolveAgentContextOwner,
  resolveVerifiedOwner,
} from "../../lib/owner.js";
import {
  commitCredit,
  decrementCredits,
  refundCredit,
} from "../../lib/quota.js";
import { saveEnrichmentSnapshot } from "../../lib/saved-enrichments.js";
import { createSseSender } from "../../lib/sse.js";
import {
  keySourceLabel,
  metricsStartedAt,
  recordDesignArtifactEvent,
  recordEnrichRequest,
  recordQuotaEvent,
  withActionMetricCaller,
} from "../../lib/metrics.js";

/**
 * POST /api/enrich-design-md (SSE)
 *
 * Gated: hosted calls use the deployment's server key and quota rules.
 * Self-hosted calls may use ANTHROPIC_API_KEY from the deployment environment
 * without account billing or quota.
 *
 * Body: JSON payload from a prior /api/extract?format=json call.
 * Response: text/event-stream with delta/done/error events.
 */
export default defineEventHandler(async (event) => {
  const startedAt = metricsStartedAt();
  const body = await readBody(event);

  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    await recordEnrichRequest({
      status: "bad_body",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
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
    await recordEnrichRequest({
      status: "missing_fields",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
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
    await recordEnrichRequest({
      status: "user_key_rejected",
      keySource: "none",
      quota: "blocked",
      startedAt,
    });
    return {
      error: "user_keys_not_accepted",
      reason:
        "Hosted API calls do not accept Anthropic keys. Use purchased AI runs or run a local/self-hosted deployment with ANTHROPIC_API_KEY.",
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
      await recordEnrichRequest({
        status: "self_hosted_key_missing",
        keySource: "none",
        quota: "not_applicable",
        startedAt,
      });
      return {
        error: "self_hosted_anthropic_key_missing",
        reason: "Set ANTHROPIC_API_KEY on this self-hosted deployment.",
      };
    }
    setResponseStatus(event, 402);
    await recordEnrichRequest({
      status: "no_api_key",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "no_api_key_available", reason: "server-key-required" };
  }
  const keySource = keySourceLabel(resolvedKey.source);

  let quotaOwner = owner;
  if (resolvedKey.consumesQuota) {
    const verifiedOwner = await resolveVerifiedOwner(event);
    if (!verifiedOwner) {
      setResponseStatus(event, 401);
      await recordEnrichRequest({
        status: "sign_in_required",
        keySource,
        quota: "blocked",
        startedAt,
      });
      return {
        error: "sign_in_required",
        reason: "sign in with email to purchase and use AI runs",
      };
    }
    quotaOwner = verifiedOwner;
  }

  let dec: { ok: boolean; remaining: number; operationId: string } | null =
    null;
  if (resolvedKey.consumesQuota) {
    dec = await decrementCredits(quotaOwner, undefined, "enrich");
    if (!dec.ok) {
      setResponseStatus(event, 402);
      await recordQuotaEvent({ route: "enrich", event: "exhausted" });
      await recordEnrichRequest({
        status: "out_of_credits",
        keySource,
        quota: "exhausted",
        startedAt,
      });
      return {
        error: "out_of_credits",
        reason: "signed-in-and-out-of-credits",
      };
    }
    await recordQuotaEvent({ route: "enrich", event: "decremented" });
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
        await withActionMetricCaller("http", async () => {
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
                const saved = await saveEnrichmentSnapshot({
                  owner: { ownerId: quotaOwner },
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
                await recordDesignArtifactEvent({
                  action: "public_snapshot_saved",
                  source: "home",
                  variant: "enriched",
                  format: "snapshot",
                });
                saveResult = {
                  savedDesignId: saved.id,
                  savedDesignUrl: saved.url,
                };
              } catch (saveErr) {
                saveResult = {
                  saveError:
                    saveErr instanceof Error
                      ? saveErr.message
                      : String(saveErr),
                };
              }
              await recordEnrichRequest({
                status: "success",
                keySource,
                quota: resolvedKey.consumesQuota ? "consumed" : "not_consumed",
                startedAt,
              });
              if (dec?.ok) await commitCredit(dec.operationId);
              sse.send("done", { ...result, ...(saveResult ?? {}) });
            }
          }
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (resolvedKey.consumesQuota && dec?.ok) {
          await refundCredit(quotaOwner, dec.operationId).catch(() => {});
          await recordQuotaEvent({ route: "enrich", event: "refunded" });
        }
        await recordEnrichRequest({
          status: "stream_error",
          keySource,
          quota:
            resolvedKey.consumesQuota && dec?.ok ? "refunded" : "not_consumed",
          startedAt,
        });
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
