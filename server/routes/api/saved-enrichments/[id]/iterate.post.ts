import {
  defineEventHandler,
  getHeader,
  getRouterParam,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import {
  iterateStream,
  type IterationInput,
} from "../../../../../actions/iterate-design-md.js";
import {
  containsRequestAnthropicApiKey,
  resolveAnthropicKey,
} from "../../../../lib/anthropic-key.js";
import {
  resolveAgentContextOwner,
  resolveVerifiedOwner,
} from "../../../../lib/owner.js";
import {
  commitCredit,
  decrementCredits,
  refundCredit,
} from "../../../../lib/quota.js";
import {
  getPublicSavedEnrichment,
  saveEnrichmentSnapshot,
} from "../../../../lib/saved-enrichments.js";
import { createSseSender } from "../../../../lib/sse.js";
import {
  INPUT_CAPS,
  checkBlocklist,
} from "../../../../../shared/iteration-security.js";
import { applyDeterministicRadiusFidelity } from "../../../../../shared/radius-fidelity.js";
import {
  keySourceLabel,
  metricsStartedAt,
  recordDesignArtifactEvent,
  recordIterateRequest,
  recordQuotaEvent,
  withActionMetricCaller,
} from "../../../../lib/metrics.js";

const SECTION_RE = /^[a-z0-9-]{1,40}$/;

export default defineEventHandler(async (event) => {
  const startedAt = metricsStartedAt();
  const id = getRouterParam(event, "id");
  if (!id) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "missing_saved_id",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "saved enrichment id is required" };
  }

  const parent = await getPublicSavedEnrichment(id);
  if (!parent) {
    setResponseStatus(event, 404);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "not_found",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "saved enrichment not found" };
  }

  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "bad_body",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "bad_body" };
  }

  const userPrompt =
    typeof (body as Record<string, unknown>).userPrompt === "string"
      ? ((body as Record<string, unknown>).userPrompt as string)
      : null;
  const sectionTarget =
    typeof (body as Record<string, unknown>).sectionTarget === "string"
      ? ((body as Record<string, unknown>).sectionTarget as string)
      : null;

  if (!userPrompt) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "missing_fields",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "missing_fields" };
  }
  if (userPrompt.length > INPUT_CAPS.userPrompt) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "user_prompt_too_long",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "userPrompt_too_long" };
  }
  if (parent.enrichedMarkdown.length > INPUT_CAPS.parentMarkdown) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "previous_markdown_too_long",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "previousMarkdown_too_long" };
  }
  if (sectionTarget && !SECTION_RE.test(sectionTarget)) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "bad_section_target",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "bad_section_target" };
  }

  const blockHit = checkBlocklist(userPrompt);
  if (blockHit) {
    setResponseStatus(event, 422);
    await recordIterateRequest({
      route: "saved_iterate",
      status: "blocked",
      keySource: "none",
      quota: "blocked",
      startedAt,
    });
    return { error: "blocked", reason: blockHit };
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
    await recordIterateRequest({
      route: "saved_iterate",
      status: "user_key_rejected",
      keySource: "none",
      quota: "blocked",
      startedAt,
    });
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
      await recordIterateRequest({
        route: "saved_iterate",
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
    await recordIterateRequest({
      route: "saved_iterate",
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
      await recordIterateRequest({
        route: "saved_iterate",
        status: "sign_in_required",
        keySource,
        quota: "blocked",
        startedAt,
      });
      return {
        error: "sign_in_required",
        reason: "sign in with email to purchase and use AI credits",
      };
    }
    quotaOwner = verifiedOwner;
  }

  const saveOwner = { ownerId: quotaOwner };

  let dec: { ok: boolean; remaining: number; operationId: string } | null = null;
  if (resolvedKey.consumesQuota) {
    dec = await decrementCredits(quotaOwner, undefined, "saved-iterate");
    if (!dec.ok) {
      setResponseStatus(event, 402);
      await recordQuotaEvent({ route: "saved_iterate", event: "exhausted" });
      await recordIterateRequest({
        route: "saved_iterate",
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
    await recordQuotaEvent({ route: "saved_iterate", event: "decremented" });
  }

  const input: IterationInput = {
    previousMarkdown: parent.enrichedMarkdown,
    userPrompt,
    sectionTarget: sectionTarget ?? undefined,
    deterministicMarkdown: parent.deterministicMarkdown,
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
          for await (const ev of iterateStream(input)) {
            if (ev.type === "delta") {
              sse.send("delta", { text: ev.text });
            } else {
              const { type: _drop, ...rawResult } = ev;
              const result = {
                ...rawResult,
                markdown: applyDeterministicRadiusFidelity(
                  rawResult.markdown,
                  parent.designSystemData,
                ),
              };
              const saved = await saveEnrichmentSnapshot({
                owner: saveOwner,
                sourceUrl: parent.sourceUrl,
                deterministicMarkdown: parent.deterministicMarkdown,
                enrichedMarkdown: result.markdown,
                designSystemData: parent.designSystemData,
                signals: parent.signals,
                screenshotDataUrl: parent.screenshotDataUrl,
                parentId: parent.id,
                rootId: parent.rootId ?? parent.id,
                iterationPrompt: userPrompt,
                model: result.model,
                usage: result.usage,
                stopReason: result.stopReason,
              });
              await recordDesignArtifactEvent({
                action: "public_snapshot_saved",
                source: "saved_design",
                variant: "iteration",
                format: "snapshot",
              });
              await recordIterateRequest({
                route: "saved_iterate",
                status: "success",
                keySource,
                quota: resolvedKey.consumesQuota ? "consumed" : "not_consumed",
                startedAt,
              });
              if (dec?.ok) await commitCredit(dec.operationId);
              sse.send("done", {
                ...result,
                savedDesignId: saved.id,
                savedDesignUrl: saved.url,
                parentId: parent.id,
                rootId: parent.rootId ?? parent.id,
                remaining: dec?.remaining ?? null,
              });
            }
          }
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (resolvedKey.consumesQuota && dec?.ok) {
          await refundCredit(quotaOwner, dec.operationId).catch(() => {});
          await recordQuotaEvent({ route: "saved_iterate", event: "refunded" });
        }
        await recordIterateRequest({
          route: "saved_iterate",
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
