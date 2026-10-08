import type { Page, Response } from "playwright";
import {
  ExtractionError,
  ExtractionTrace,
  classifyExtractionError,
} from "./extraction-diagnostics.js";

export function assertSafeExtractionUrl(rawUrl: string): URL {
  const input = rawUrl.trim();
  const hasPort = /^[^/?#:\s]+:\d+(?:[/?#]|$)/.test(input);
  const url =
    !hasPort && /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ExtractionError("invalid_url", "validation");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new ExtractionError("invalid_url", "validation");
  }
  const hostname = parsed.hostname.replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.startsWith("127.") ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") ||
    hostname.startsWith("172.17.") ||
    hostname.startsWith("172.18.") ||
    hostname.startsWith("172.19.") ||
    hostname.startsWith("172.2") ||
    hostname.startsWith("172.30.") ||
    hostname.startsWith("172.31.") ||
    hostname.startsWith("192.168.") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname.startsWith("169.254.")
  )
    throw new ExtractionError("private_url", "validation");
  return parsed;
}

function checkResponse(response: Response | null, trace: ExtractionTrace) {
  if (!response) throw new ExtractionError("empty_page", "navigation");
  const status = response.status();
  trace.upstreamStatus = status;
  if (status === 401 || status === 403)
    throw new ExtractionError("access_denied", "navigation", status);
  if (status === 404 || status === 410)
    throw new ExtractionError("not_found", "navigation", status);
  if (status === 429)
    throw new ExtractionError("rate_limited", "navigation", status);
  if (status >= 500)
    throw new ExtractionError("upstream_error", "navigation", status);
  if (status >= 400)
    throw new ExtractionError("access_denied", "navigation", status);
  const contentType = response
    .headers()
    ["content-type"]?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (
    contentType &&
    !["text/html", "application/xhtml+xml"].includes(contentType)
  ) {
    throw new ExtractionError("unsupported_content", "navigation", status);
  }
}

export async function navigateForExtraction(
  page: Page,
  target: URL,
  trace: ExtractionTrace,
) {
  // Retry only transient transport failures and gateway errors, once. Never
  // bypass access controls/certificates or amplify a site's rate limit.
  for (let attempt = 0; attempt < 2; attempt++) {
    trace.upstreamStatus = undefined;
    try {
      await trace.run("navigation", async () => {
        const response = await page.goto(target.toString(), {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });
        checkResponse(response, trace);
      });
      break;
    } catch (error) {
      const failure = classifyExtractionError(error, "navigation");
      const retryable =
        failure.code === "timeout" ||
        failure.code === "connection" ||
        (failure.code === "upstream_error" &&
          [502, 503, 504].includes(failure.upstreamStatus ?? 0));
      if (attempt > 0 || !retryable) throw failure;
      trace.retries.push(failure.code);
      await page.waitForTimeout(500);
    }
  }
  await trace.run("page_ready", async () => {
    try {
      await page.waitForLoadState("networkidle", { timeout: 5_000 });
    } catch (error) {
      if (classifyExtractionError(error, "page_ready").code !== "timeout")
        throw error;
      trace.warn("page_still_loading");
    }
    // Check the final document; do not extract a successful-looking CAPTCHA.
    const blocked = await page.evaluate(() => {
      const title = document.title.trim().toLowerCase();
      return (
        /^(just a moment[.!…]*|attention required[! ]*(\| cloudflare)?|verify you are human|security verification|access denied)$/.test(
          title,
        ) ||
        !!document.querySelector(
          "#challenge-running, #challenge-stage, form#challenge-form",
        )
      );
    });
    if (blocked)
      throw new ExtractionError(
        "bot_challenge",
        "page_ready",
        trace.upstreamStatus,
      );
  });
}

export async function captureExtractionScreenshot(
  page: Page,
  trace: ExtractionTrace,
): Promise<string> {
  try {
    return await trace.run("screenshot", async () => {
      const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      const buffer = await page.screenshot({
        type: "png",
        timeout: 6_000,
        animations: "disabled",
        clip: {
          x: 0,
          y: 0,
          width: 1280,
          height: Math.max(1, Math.min(height, 7500)),
        },
      });
      return `data:image/png;base64,${buffer.toString("base64")}`;
    });
  } catch {
    try {
      const buffer = await trace.run("screenshot", () =>
        page.screenshot({
          type: "png",
          fullPage: false,
          timeout: 3_000,
          animations: "disabled",
        }),
      );
      trace.warn("screenshot_viewport");
      return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      // A screenshot is useful for AI enrichment, but optional for the free spec.
      trace.warn("screenshot_unavailable");
      return "";
    }
  }
}
