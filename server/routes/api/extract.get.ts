import {
  defineEventHandler,
  getQuery,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import extractAction from "../../../actions/extract-design-md.js";
import {
  metricsStartedAt,
  recordExtractRequest,
} from "../../lib/metrics.js";

export default defineEventHandler(async (event) => {
  const startedAt = metricsStartedAt();
  const query = getQuery(event);
  const url = query.url;
  const wantsJson = query.format === "json";
  const format = wantsJson ? "json" : "markdown";

  if (typeof url !== "string" || !url.trim()) {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    recordExtractRequest({ status: "bad_request", format, startedAt });
    return "missing url query param";
  }

  try {
    const result = await extractAction.run({ url });
    recordExtractRequest({ status: "success", format, startedAt });
    if (wantsJson) {
      setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");
      return result;
    }
    setResponseHeader(event, "Content-Type", "text/markdown; charset=utf-8");
    return result.markdown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isBadUrl =
      message.includes("Internal/private") ||
      message.includes("Only http") ||
      message.includes("Invalid URL");
    setResponseStatus(event, isBadUrl ? 400 : 500);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    recordExtractRequest({
      status: isBadUrl ? "bad_request" : "error",
      format,
      startedAt,
    });
    return isBadUrl ? message : `extraction failed: ${message}`;
  }
});
