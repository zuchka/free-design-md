import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { getSession } from "@agent-native/core/server";
import { consumeQuota } from "../../lib/builder-quota.js";
import {
  enrichStream,
  type EnrichInput,
} from "../../../actions/enrich-design-md.js";

/**
 * POST /api/enrich-design-md (SSE)
 *
 * Body: JSON payload from a prior /api/extract?format=json call
 * (url + designSystemData + signals + deterministicMarkdown + screenshotDataUrl).
 *
 * Response: text/event-stream with these event types:
 *   - event: delta   data: {"text": "<chunk>"}
 *   - event: done    data: {"url","markdown","model","latencyMs","usage","stopReason"}
 *   - event: error   data: {"message": "..."}
 *
 * The client (app/routes/_index.tsx) appends each delta to the AI-enriched
 * pane as it arrives; on `done` it swaps in the final EnrichResult with
 * usage stats.
 */
export default defineEventHandler(async (event) => {
  const session = await getSession(event).catch(() => null);
  if (!session?.userId) {
    setResponseStatus(event, 401);
    setResponseHeader(event, "Content-Type", "application/json");
    return { error: "Sign in with Builder.io to enrich" };
  }
  const charged = await consumeQuota(session.userId);
  if (!charged.ok) {
    setResponseStatus(event, 402);
    setResponseHeader(event, "Content-Type", "application/json");
    return {
      error: "You've used all 3 free AI enrichments on your account",
      remaining: 0,
    };
  }

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

  // Accept either `deterministicMarkdown` or `markdown` (the field name on the
  // /api/extract response). Prefer the explicit one if both are present.
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

  const input: EnrichInput = {
    url,
    designSystemData,
    signals,
    screenshotDataUrl,
    deterministicMarkdown: md,
  };

  setResponseHeader(event, "Content-Type", "text/event-stream; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "no-cache, no-transform");
  setResponseHeader(event, "Connection", "keep-alive");
  // Hint to proxies (nginx, h3 SSE clients) to disable buffering.
  setResponseHeader(event, "X-Accel-Buffering", "no");

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (eventName: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`,
          ),
        );
      };

      try {
        for await (const ev of enrichStream(input)) {
          if (ev.type === "delta") {
            send("delta", { text: ev.text });
          } else {
            const { type: _drop, ...result } = ev;
            send("done", result);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });
});
