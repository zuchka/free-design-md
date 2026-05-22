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

/**
 * POST /api/enrich-design-md (SSE)
 *
 * Public endpoint — no auth, no quota. Server reads ANTHROPIC_API_KEY (or a
 * future Builder-connected credential) and streams the enriched design.md.
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
