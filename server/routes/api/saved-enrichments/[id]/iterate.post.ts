import {
  defineEventHandler,
  getCookie,
  getRouterParam,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import {
  iterateStream,
  type IterationInput,
} from "../../../../../actions/iterate-design-md.js";
import { resolveAnthropicKey } from "../../../../lib/anthropic-key.js";
import { resolveConnectedBuilderOwner } from "../../../../lib/builder-connection.js";
import { FDMD_ANON_COOKIE } from "../../../../lib/cookie-names.js";
import { ANONYMOUS_OWNER, resolveOwner } from "../../../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../../../lib/quota.js";
import {
  getPublicSavedEnrichment,
  saveEnrichmentSnapshot,
  type SavedEnrichmentOwner,
} from "../../../../lib/saved-enrichments.js";
import { createSseSender } from "../../../../lib/sse.js";
import {
  INPUT_CAPS,
  checkBlocklist,
} from "../../../../../shared/iteration-security.js";

const SECTION_RE = /^[a-z0-9-]{1,40}$/;

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    setResponseStatus(event, 400);
    return { error: "saved enrichment id is required" };
  }

  const parent = await getPublicSavedEnrichment(id);
  if (!parent) {
    setResponseStatus(event, 404);
    return { error: "saved enrichment not found" };
  }

  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
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
    return { error: "missing_fields" };
  }
  if (userPrompt.length > INPUT_CAPS.userPrompt) {
    setResponseStatus(event, 400);
    return { error: "userPrompt_too_long" };
  }
  if (parent.enrichedMarkdown.length > INPUT_CAPS.parentMarkdown) {
    setResponseStatus(event, 400);
    return { error: "previousMarkdown_too_long" };
  }
  if (sectionTarget && !SECTION_RE.test(sectionTarget)) {
    setResponseStatus(event, 400);
    return { error: "bad_section_target" };
  }

  const blockHit = checkBlocklist(userPrompt);
  if (blockHit) {
    setResponseStatus(event, 422);
    return { error: "blocked", reason: blockHit };
  }

  const owner = await resolveOwner(event);

  let resolvedKey: { apiKey: string; source: string; consumesQuota: boolean };
  try {
    resolvedKey = await resolveAnthropicKey(event);
  } catch {
    setResponseStatus(event, 402);
    return { error: "no_api_key_available", reason: "byo-key-required" };
  }

  let connectedBuilderOwner = await resolveConnectedBuilderOwner(owner);
  let quotaOwner = owner;
  if (resolvedKey.consumesQuota) {
    if (owner === ANONYMOUS_OWNER) {
      if (!connectedBuilderOwner) {
        setResponseStatus(event, 401);
        return {
          error: "sign_in_required",
          reason: "add a BYO key or connect Builder",
        };
      }
      quotaOwner = connectedBuilderOwner.ownerId;
    }
  }

  const saveOwner =
    connectedBuilderOwner ?? fallbackSavedOwner(owner, getCookie(event, FDMD_ANON_COOKIE));

  let dec: { ok: boolean; remaining: number } | null = null;
  if (resolvedKey.consumesQuota) {
    dec = await decrementCredits(quotaOwner);
    if (!dec.ok) {
      setResponseStatus(event, 402);
      return { error: "out_of_credits", reason: "signed-in-and-out-of-credits" };
    }
  }

  const input: IterationInput = {
    previousMarkdown: parent.enrichedMarkdown,
    userPrompt,
    sectionTarget: sectionTarget ?? undefined,
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
        for await (const ev of iterateStream(input)) {
          if (ev.type === "delta") {
            sse.send("delta", { text: ev.text });
          } else {
            const { type: _drop, ...result } = ev;
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

function fallbackSavedOwner(
  owner: string,
  anonToken: string | undefined,
): SavedEnrichmentOwner {
  if (owner && owner !== ANONYMOUS_OWNER) {
    return { ownerId: `user:${owner}` };
  }
  return { ownerId: anonToken ? `anon:${anonToken}` : "public:anonymous" };
}
