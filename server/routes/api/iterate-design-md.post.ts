import {
  defineEventHandler,
  getHeader,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { randomUUID } from "node:crypto";
import { getDbExec } from "@agent-native/core/db";
import {
  iterateStream,
  type IterationInput,
} from "../../../actions/iterate-design-md.js";
import { isAnonymousOwner, resolveAgentContextOwner } from "../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../lib/quota.js";
import {
  containsRequestAnthropicApiKey,
  resolveAnthropicKey,
} from "../../lib/anthropic-key.js";
import { resolveConnectedBuilderOwner } from "../../lib/builder-connection.js";
import {
  getPublicSavedEnrichment,
  saveEnrichmentSnapshot,
} from "../../lib/saved-enrichments.js";
import {
  INPUT_CAPS,
  checkBlocklist,
} from "../../../shared/iteration-security.js";
import { createSseSender } from "../../lib/sse.js";
import { applyDeterministicRadiusFidelity } from "../../../shared/radius-fidelity.js";
import {
  keySourceLabel,
  metricsStartedAt,
  recordDesignArtifactEvent,
  recordIterateRequest,
  recordQuotaEvent,
} from "../../lib/metrics.js";

const SECTION_RE = /^[a-z0-9-]{1,40}$/;

/**
 * POST /api/iterate-design-md (SSE)
 *
 * Revises an AI-enriched design.md per a one-off user instruction.
 * Each successful iteration consumes 1 credit from the app-wide
 * `fdmd_quota` row keyed on the resolved owner.
 *
 * Body: { sessionId, previousMarkdown, userPrompt, url?, sectionTarget?, parentId?,
 *         deterministicMarkdown?, designSystemData?, signals?, screenshotDataUrl? }
 * Response: text/event-stream with delta/done/error events.
 */
export default defineEventHandler(async (event) => {
  const startedAt = metricsStartedAt();
  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "iterate",
      status: "bad_body",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "bad_body" };
  }

  const previousMarkdown =
    typeof (body as Record<string, unknown>).previousMarkdown === "string"
      ? ((body as Record<string, unknown>).previousMarkdown as string)
      : null;
  const userPrompt =
    typeof (body as Record<string, unknown>).userPrompt === "string"
      ? ((body as Record<string, unknown>).userPrompt as string)
      : null;
  const sessionId =
    typeof (body as Record<string, unknown>).sessionId === "string"
      ? ((body as Record<string, unknown>).sessionId as string)
      : null;
  const sectionTarget =
    typeof (body as Record<string, unknown>).sectionTarget === "string"
      ? ((body as Record<string, unknown>).sectionTarget as string)
      : null;
  const parentId =
    typeof (body as Record<string, unknown>).parentId === "string"
      ? ((body as Record<string, unknown>).parentId as string)
      : null;
  const url =
    typeof (body as Record<string, unknown>).url === "string"
      ? ((body as Record<string, unknown>).url as string)
      : "";
  const deterministicMarkdown =
    typeof (body as Record<string, unknown>).deterministicMarkdown === "string"
      ? ((body as Record<string, unknown>).deterministicMarkdown as string)
      : null;
  const designSystemData = (body as Record<string, unknown>).designSystemData;
  const signals = (body as Record<string, unknown>).signals;
  const screenshotDataUrl =
    typeof (body as Record<string, unknown>).screenshotDataUrl === "string"
      ? ((body as Record<string, unknown>).screenshotDataUrl as string)
      : null;

  if (!previousMarkdown || !userPrompt || !sessionId) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "iterate",
      status: "missing_fields",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "missing_fields" };
  }
  if (previousMarkdown.length > INPUT_CAPS.parentMarkdown) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "iterate",
      status: "previous_markdown_too_long",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "previousMarkdown_too_long" };
  }
  if (userPrompt.length > INPUT_CAPS.userPrompt) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "iterate",
      status: "user_prompt_too_long",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "userPrompt_too_long" };
  }
  if (sectionTarget && !SECTION_RE.test(sectionTarget)) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "iterate",
      status: "bad_section_target",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "bad_section_target" };
  }

  const owner = await resolveAgentContextOwner(event);
  const connectedBuilderOwner = await resolveConnectedBuilderOwner(owner);
  const bodyRecord = body as Record<string, unknown>;

  if (
    containsRequestAnthropicApiKey(
      bodyRecord,
      getHeader(event, "x-anthropic-api-key"),
    )
  ) {
    setResponseStatus(event, 400);
    await recordIterateRequest({
      route: "iterate",
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
        route: "iterate",
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
      route: "iterate",
      status: "no_api_key",
      keySource: "none",
      quota: "not_applicable",
      startedAt,
    });
    return { error: "no_api_key_available", reason: "server-key-required" };
  }
  const keySource = keySourceLabel(resolvedKey.source);

  // Pre-flight blocklist BEFORE any quota spend — jailbreaks are free to attempt
  // and free to record, but never cost a credit.
  const blockHit = checkBlocklist(userPrompt);
  if (blockHit) {
    await insertRejected({
      sessionId,
      parentId,
      url,
      owner,
      userPrompt,
      sectionTarget,
      rejectedReason: `blocklist:${blockHit}`,
    });
    setResponseStatus(event, 422);
    await recordIterateRequest({
      route: "iterate",
      status: "blocked",
      keySource,
      quota: "blocked",
      startedAt,
    });
    return { error: "blocked", reason: blockHit };
  }

  // Atomic quota decrement before streaming (only when consuming quota).
  let dec: { ok: boolean; remaining: number } | null = null;
  let quotaOwner = owner;
  if (resolvedKey.consumesQuota) {
    if (isAnonymousOwner(owner)) {
      if (!connectedBuilderOwner) {
        setResponseStatus(event, 401);
        await recordIterateRequest({
          route: "iterate",
          status: "sign_in_required",
          keySource,
          quota: "blocked",
          startedAt,
        });
        return {
          error: "sign_in_required",
          reason: "connect Builder to use hosted AI credits",
        };
      }
      quotaOwner = connectedBuilderOwner.ownerId;
    }

    dec = await decrementCredits(quotaOwner);
    if (!dec.ok) {
      setResponseStatus(event, 402);
      await recordQuotaEvent({ route: "iterate", event: "exhausted" });
      await recordIterateRequest({
        route: "iterate",
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
    await recordQuotaEvent({ route: "iterate", event: "decremented" });
  }

  setResponseHeader(event, "Content-Type", "text/event-stream; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "no-cache, no-transform");
  setResponseHeader(event, "Connection", "keep-alive");
  setResponseHeader(event, "X-Accel-Buffering", "no");

  const id = randomUUID();
  const input: IterationInput = {
    previousMarkdown,
    userPrompt,
    sectionTarget: sectionTarget ?? undefined,
    deterministicMarkdown: deterministicMarkdown ?? undefined,
  };

  let sse: ReturnType<typeof createSseSender> | null = null;
  return new ReadableStream({
    async start(controller) {
      sse = createSseSender(controller);

      try {
        for await (const ev of iterateStream(input)) {
          if (ev.type === "delta") {
            sse.send("delta", { text: ev.text });
          } else {
            // done
            const { type: _drop, ...rawResult } = ev;
            const result = {
              ...rawResult,
              markdown: applyDeterministicRadiusFidelity(
                rawResult.markdown,
                designSystemData,
              ),
            };
            await insertSuccess({
              id,
              sessionId,
              parentId,
              url,
              owner,
              userPrompt,
              sectionTarget,
              result,
            });
            let saveResult:
              | { savedDesignId: string; savedDesignUrl: string }
              | { saveError: string }
              | null = null;
            if (
              connectedBuilderOwner &&
              url &&
              deterministicMarkdown &&
              designSystemData &&
              signals
            ) {
              try {
                const parent = parentId
                  ? await getPublicSavedEnrichment(parentId)
                  : null;
                const saved = await saveEnrichmentSnapshot({
                  owner: connectedBuilderOwner,
                  sourceUrl: url,
                  deterministicMarkdown,
                  enrichedMarkdown: result.markdown,
                  designSystemData,
                  signals,
                  screenshotDataUrl,
                  parentId: parent?.id ?? parentId,
                  rootId: parent?.rootId ?? parent?.id ?? parentId,
                  iterationPrompt: userPrompt,
                  model: result.model,
                  usage: result.usage,
                  stopReason: result.stopReason,
                });
                await recordDesignArtifactEvent({
                  action: "public_snapshot_saved",
                  source: "home",
                  variant: "iteration",
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
            }
            await recordIterateRequest({
              route: "iterate",
              status: "success",
              keySource,
              quota: resolvedKey.consumesQuota ? "consumed" : "not_consumed",
              startedAt,
            });
            sse.send("done", {
              id,
              ...result,
              remaining: dec?.remaining ?? null,
              ...(saveResult ?? {}),
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (resolvedKey.consumesQuota && dec?.ok) {
          await refundCredit(quotaOwner).catch(() => {});
          await recordQuotaEvent({ route: "iterate", event: "refunded" });
        }
        await insertRejected({
          sessionId,
          parentId,
          url,
          owner,
          userPrompt,
          sectionTarget,
          rejectedReason: message.slice(0, 200),
        }).catch(() => {});
        await recordIterateRequest({
          route: "iterate",
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

interface SuccessArgs {
  id: string;
  sessionId: string;
  parentId: string | null;
  url: string;
  owner: string;
  userPrompt: string;
  sectionTarget: string | null;
  result: {
    markdown: string;
    model: string;
    usage: unknown;
    stopReason: string | null;
  };
}

async function insertSuccess(a: SuccessArgs): Promise<void> {
  const exec = getDbExec();
  await exec.execute({
    sql: `INSERT INTO fdmd_iterations
          (id, session_id, parent_id, url, owner, user_prompt, section_target,
           markdown, model, usage_json, stop_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      a.id,
      a.sessionId,
      a.parentId,
      a.url,
      a.owner,
      a.userPrompt,
      a.sectionTarget,
      a.result.markdown,
      a.result.model,
      JSON.stringify(a.result.usage),
      a.result.stopReason,
    ],
  });
}

interface RejectedArgs {
  sessionId: string;
  parentId: string | null;
  url: string;
  owner: string;
  userPrompt: string;
  sectionTarget: string | null;
  rejectedReason: string;
}

async function insertRejected(a: RejectedArgs): Promise<void> {
  const exec = getDbExec();
  await exec.execute({
    sql: `INSERT INTO fdmd_iterations
          (id, session_id, parent_id, url, owner, user_prompt, section_target,
           markdown, model, rejected_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
    args: [
      randomUUID(),
      a.sessionId,
      a.parentId,
      a.url,
      a.owner,
      a.userPrompt,
      a.sectionTarget,
      a.rejectedReason,
    ],
  });
}
