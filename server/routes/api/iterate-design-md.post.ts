import {
  defineEventHandler,
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
import {
  isAnonymousOwner,
  resolveAgentContextOwner,
} from "../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../lib/quota.js";
import { resolveAnthropicKey } from "../../lib/anthropic-key.js";
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
  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
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
    return { error: "missing_fields" };
  }
  if (previousMarkdown.length > INPUT_CAPS.parentMarkdown) {
    setResponseStatus(event, 400);
    return { error: "previousMarkdown_too_long" };
  }
  if (userPrompt.length > INPUT_CAPS.userPrompt) {
    setResponseStatus(event, 400);
    return { error: "userPrompt_too_long" };
  }
  if (sectionTarget && !SECTION_RE.test(sectionTarget)) {
    setResponseStatus(event, 400);
    return { error: "bad_section_target" };
  }

  const owner = await resolveAgentContextOwner(event);
  const connectedBuilderOwner = await resolveConnectedBuilderOwner(owner);

  let resolvedKey: { apiKey: string; source: string; consumesQuota: boolean };
  try {
    resolvedKey = await resolveAnthropicKey(event);
  } catch {
    setResponseStatus(event, 402);
    return { error: "no_api_key_available", reason: "byo-key-required" };
  }

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
    return { error: "blocked", reason: blockHit };
  }

  // Atomic quota decrement before streaming (only when consuming quota).
  let dec: { ok: boolean; remaining: number } | null = null;
  let quotaOwner = owner;
  if (resolvedKey.consumesQuota) {
    if (isAnonymousOwner(owner)) {
      if (!connectedBuilderOwner) {
        setResponseStatus(event, 401);
        return {
          error: "sign_in_required",
          reason: "add a BYO key or connect Builder",
        };
      }
      quotaOwner = connectedBuilderOwner.ownerId;
    }

    dec = await decrementCredits(quotaOwner);
    if (!dec.ok) {
      setResponseStatus(event, 402);
      return {
        error: "out_of_credits",
        reason: "signed-in-and-out-of-credits",
      };
    }
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
    anthropicApiKey: resolvedKey.apiKey,
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
