import { recordGrowthEvent } from "../../lib/analytics.js";
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

import {
  ExtractionTrace,
  ExtractionError,
  withExtractionTrace,
  classifyExtractionError,
} from "../../lib/extraction-diagnostics.js";
import { extractionFailures } from "../../../shared/extraction-diagnostics.js";

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

  const trace = new ExtractionTrace();
  trace.setUrl(url);
  await recordGrowthEvent({
    name: "extraction_started",
    key: `extraction:${trace.requestId}:started`,
    artifactId: trace.requestId,
  });
  setResponseHeader(event, "X-Request-Id", trace.requestId);
  setResponseHeader(event, "Cache-Control", "no-store");

  try {
    const response = await withActionMetricCaller("http", () =>
      withExtractionTrace(async () => {
        if (!format || typeof url !== "string" || !url.trim()) {
          throw new ExtractionError("invalid_request", "validation");
        }
        const result = (await extractAction.run({
          url,
        })) as ExtractActionResult;
        return trace.run("response", () => {
          if (format === "json") {
            setResponseHeader(
              event,
              "Content-Type",
              "application/json; charset=utf-8",
            );
            return {
              ...result,
              diagnostics: {
                requestId: trace.requestId,
                warnings: trace.warnings,
              },
            };
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
          setResponseHeader(
            event,
            "Content-Type",
            "text/markdown; charset=utf-8",
          );
          return result.markdown;
        });
      }, trace),
    );
    await recordExtractRequest({
      status: "success",
      format: format!,
      startedAt,
    });
    return response;
  } catch (err) {
    const failure = classifyExtractionError(err, trace.stage);
    const detail = extractionFailures[failure.code];
    setResponseStatus(event, detail.status);
    if (failure.code === "rate_limited")
      setResponseHeader(event, "Retry-After", "60");
    await recordExtractRequest({
      status: detail.status === 400 ? "bad_request" : "error",
      format: format ?? "invalid",
      startedAt,
    });
    if (format === "json") {
      setResponseHeader(
        event,
        "Content-Type",
        "application/json; charset=utf-8",
      );
      return {
        error: {
          code: failure.code,
          message: detail.message,
          hint: detail.hint,
          retryable: detail.retryable,
          stage: failure.stage,
          requestId: trace.requestId,
        },
      };
    }
    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    const message = !format
      ? "format must be one of: json, markdown, md, mdx"
      : typeof url !== "string" || !url.trim()
        ? "missing url query param"
        : `${detail.message} ${detail.hint}`;
    return `${message} (Reference: ${trace.requestId})`;
  }
});
