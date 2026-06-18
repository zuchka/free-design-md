import {
  defineEventHandler,
  getQuery,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import extractAction from "../../../actions/extract-design-md.js";
import type { DesignSystemData } from "../../../shared/api.js";
import { designArtifactToMdx } from "../../../shared/design-mdx.js";
import type { ExtractedSignals } from "../../../shared/extract-design-system.js";
import { renderPreview } from "../../../shared/preview-template.js";
import {
  metricsStartedAt,
  recordExtractRequest,
  withActionMetricCaller,
} from "../../lib/metrics.js";

type ExtractFormat = "json" | "markdown" | "mdx";

interface ExtractActionResult {
  url: string;
  designSystemData: DesignSystemData;
  markdown: string;
  signals: ExtractedSignals;
  screenshotDataUrl: string;
}

function normalizeFormat(value: unknown): ExtractFormat | null {
  if (value === undefined || value === null || value === "") return "markdown";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "json") return "json";
  if (normalized === "mdx") return "mdx";
  if (normalized === "markdown" || normalized === "md") return "markdown";
  return null;
}

export default defineEventHandler(async (event) => {
  const startedAt = metricsStartedAt();
  const query = getQuery(event);
  const url = query.url;
  const format = normalizeFormat(query.format);

  if (!format) {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    await recordExtractRequest({
      status: "bad_request",
      format: "invalid",
      startedAt,
    });
    return "format must be one of: json, markdown, md, mdx";
  }

  if (typeof url !== "string" || !url.trim()) {
    setResponseStatus(event, 400);
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    await recordExtractRequest({ status: "bad_request", format, startedAt });
    return "missing url query param";
  }

  try {
    const result = (await withActionMetricCaller("http", () =>
      extractAction.run({ url }),
    )) as ExtractActionResult;
    await recordExtractRequest({ status: "success", format, startedAt });
    if (format === "json") {
      setResponseHeader(
        event,
        "Content-Type",
        "application/json; charset=utf-8",
      );
      return result;
    }
    if (format === "mdx") {
      const title = result.signals.title || new URL(result.url).hostname;
      const previewHtml = renderPreview(result.designSystemData, {
        title,
        designMd: result.markdown,
      });
      setResponseHeader(event, "Content-Type", "text/mdx; charset=utf-8");
      return designArtifactToMdx({
        title,
        markdown: result.markdown,
        previewHtml,
        sourceUrl: result.url,
        variant: "deterministic",
      });
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
    await recordExtractRequest({
      status: isBadUrl ? "bad_request" : "error",
      format,
      startedAt,
    });
    return isBadUrl ? message : `extraction failed: ${message}`;
  }
});
