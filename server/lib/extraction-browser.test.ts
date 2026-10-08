import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";
import {
  assertSafeExtractionUrl,
  captureExtractionScreenshot,
  navigateForExtraction,
} from "./extraction-browser";
import { ExtractionTrace } from "./extraction-diagnostics";

function pageMock(status = 200, contentType = "text/html") {
  return {
    goto: vi.fn().mockResolvedValue({
      status: () => status,
      headers: () => ({ "content-type": contentType }),
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(false),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("screenshot")),
  };
}
const target = new URL("https://example.com");

describe("extraction URL validation", () => {
  it.each([
    "localhost",
    "http://127.0.0.2",
    "http://[::1]",
    "http://10.1.1.1",
    "http://172.20.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "https://x.internal",
    "https://x.local",
    "http://localhost.",
  ])("rejects private URL %s", (url) => {
    expect(() => assertSafeExtractionUrl(url)).toThrow(
      expect.objectContaining({ code: "private_url" }),
    );
  });
  it.each([
    "ftp://example.com",
    "file:///tmp/file",
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "",
    "https://",
  ])("rejects invalid URL %s", (url) => {
    expect(() => assertSafeExtractionUrl(url)).toThrow(
      expect.objectContaining({ code: "invalid_url" }),
    );
  });
  it("trims input, supports uppercase schemes, bare domains and ports", () => {
    expect(assertSafeExtractionUrl("  HTTPS://Example.com  ").href).toBe(
      target.href,
    );
    expect(assertSafeExtractionUrl("example.com").href).toBe(target.href);
    expect(assertSafeExtractionUrl("example.com:8080/path").href).toBe(
      "https://example.com:8080/path",
    );
  });
});

describe("navigation recovery", () => {
  it("retries a transient timeout once without waiting for all resources to load", async () => {
    const page = pageMock();
    page.goto.mockRejectedValueOnce(
      new Error("page.goto: Timeout 15000ms exceeded"),
    );
    const trace = new ExtractionTrace();
    await navigateForExtraction(page as unknown as Page, target, trace);
    expect(page.goto).toHaveBeenCalledTimes(2);
    expect(page.goto).toHaveBeenCalledWith(target.href, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    expect(trace.retries).toEqual(["timeout"]);
  });
  it("stops after the second failure", async () => {
    const page = pageMock();
    page.goto.mockRejectedValue(new Error("net::ERR_CONNECTION_RESET"));
    await expect(
      navigateForExtraction(
        page as unknown as Page,
        target,
        new ExtractionTrace(),
      ),
    ).rejects.toMatchObject({ code: "connection", stage: "navigation" });
    expect(page.goto).toHaveBeenCalledTimes(2);
  });
  it.each([
    [401, "access_denied"],
    [403, "access_denied"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "upstream_error"],
  ])("classifies HTTP %s without retry", async (status, code) => {
    const page = pageMock(status as number);
    await expect(
      navigateForExtraction(
        page as unknown as Page,
        target,
        new ExtractionTrace(),
      ),
    ).rejects.toMatchObject({ code, upstreamStatus: status });
    expect(page.goto).toHaveBeenCalledTimes(1);
  });
  it.each([502, 503, 504])("retries HTTP %s only once", async (status) => {
    const page = pageMock(status);
    await expect(
      navigateForExtraction(
        page as unknown as Page,
        target,
        new ExtractionTrace(),
      ),
    ).rejects.toMatchObject({ code: "upstream_error" });
    expect(page.goto).toHaveBeenCalledTimes(2);
  });
  it.each(["net::ERR_NAME_NOT_RESOLVED", "net::ERR_CERT_AUTHORITY_INVALID"])(
    "does not retry %s",
    async (message) => {
      const page = pageMock();
      page.goto.mockRejectedValue(new Error(message));
      await expect(
        navigateForExtraction(
          page as unknown as Page,
          target,
          new ExtractionTrace(),
        ),
      ).rejects.toThrow();
      expect(page.goto).toHaveBeenCalledTimes(1);
    },
  );
  it("continues with a warning when analytics keep the network busy", async () => {
    const page = pageMock();
    page.waitForLoadState.mockRejectedValue(
      new Error("Timeout 5000ms exceeded"),
    );
    const trace = new ExtractionTrace();
    await navigateForExtraction(page as unknown as Page, target, trace);
    expect(trace.warnings).toEqual(["page_still_loading"]);
  });
  it("does not hide a browser crash as an ordinary load warning", async () => {
    const page = pageMock();
    page.waitForLoadState.mockRejectedValue(
      new Error("Target page, context or browser has been closed"),
    );
    await expect(
      navigateForExtraction(
        page as unknown as Page,
        target,
        new ExtractionTrace(),
      ),
    ).rejects.toMatchObject({ code: "browser_crash" });
  });
  it("rejects file responses and human verification pages", async () => {
    await expect(
      navigateForExtraction(
        pageMock(200, "application/pdf") as unknown as Page,
        target,
        new ExtractionTrace(),
      ),
    ).rejects.toMatchObject({ code: "unsupported_content" });
    const page = pageMock();
    page.evaluate.mockResolvedValue(true);
    await expect(
      navigateForExtraction(
        page as unknown as Page,
        target,
        new ExtractionTrace(),
      ),
    ).rejects.toMatchObject({ code: "bot_challenge" });
  });
});

describe("optional screenshot", () => {
  it("caps long pages and bounds the screenshot timeout", async () => {
    const page = pageMock();
    page.evaluate.mockResolvedValue(20000);
    await captureExtractionScreenshot(
      page as unknown as Page,
      new ExtractionTrace(),
    );
    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 6000,
        clip: { x: 0, y: 0, width: 1280, height: 7500 },
      }),
    );
  });
  it("uses a viewport screenshot after a full screenshot fails", async () => {
    const page = pageMock();
    page.evaluate.mockResolvedValue(800);
    page.screenshot.mockRejectedValueOnce(new Error("Timeout exceeded"));
    const trace = new ExtractionTrace();
    expect(
      await captureExtractionScreenshot(page as unknown as Page, trace),
    ).toContain("data:image/png;base64,");
    expect(trace.warnings).toEqual(["screenshot_viewport"]);
  });
  it("keeps the spec usable when both screenshots fail", async () => {
    const page = pageMock();
    page.screenshot.mockRejectedValue(new Error("page crashed"));
    const trace = new ExtractionTrace();
    expect(
      await captureExtractionScreenshot(page as unknown as Page, trace),
    ).toBe("");
    expect(trace.warnings).toEqual(["screenshot_unavailable"]);
    expect(trace.issues).toEqual([
      { stage: "screenshot", code: "browser_crash" },
      { stage: "screenshot", code: "browser_crash" },
    ]);
    expect(page.screenshot).toHaveBeenCalledTimes(2);
  });
});
