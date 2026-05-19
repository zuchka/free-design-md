import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import enrichAction from "../../../actions/enrich-design-md.js";

/**
 * POST /api/enrich-design-md
 *
 * Spike endpoint. Body is the JSON payload from a prior /api/extract?format=json
 * call (url + designSystemData + signals + deterministicMarkdown + screenshotDataUrl).
 *
 * Hard-fails loudly when ANTHROPIC_API_KEY is missing or the API call errors —
 * we want to see what broke during the spike, not silently retry.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return "POST a JSON body with the extract payload";
  }

  const { url, designSystemData, signals, screenshotDataUrl, deterministicMarkdown, markdown } =
    body as Record<string, unknown>;

  // Accept either `deterministicMarkdown` or `markdown` (the field name on the
  // /api/extract response). Prefer the explicit one if both are present.
  const md =
    typeof deterministicMarkdown === "string"
      ? deterministicMarkdown
      : typeof markdown === "string"
        ? markdown
        : "";

  if (typeof url !== "string" || !url || !designSystemData || !signals || typeof screenshotDataUrl !== "string" || !md) {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return "missing one of: url, designSystemData, signals, screenshotDataUrl, deterministicMarkdown/markdown";
  }

  try {
    const result = await enrichAction.run({
      url,
      designSystemData,
      signals,
      screenshotDataUrl,
      deterministicMarkdown: md,
    });
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isMissingKey = message.includes("ANTHROPIC_API_KEY");
    setResponseStatus(event, isMissingKey ? 503 : 500);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return `enrichment failed: ${message}`;
  }
});
