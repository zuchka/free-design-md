import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "../server/lib/metrics";

const mocks = vi.hoisted(() => {
  const locator = {
    count: async () => 0,
    first() {
      return this;
    },
  };
  const page = {
    addInitScript: vi.fn(),
    goto: vi.fn(),
    waitForLoadState: vi.fn(),
    waitForTimeout: vi.fn(),
    evaluate: vi.fn(),
    screenshot: vi.fn(),
    locator: () => locator,
    getByRole: () => locator,
  };
  const browser = { newContext: vi.fn(), close: vi.fn() };
  return { page, browser, launch: vi.fn() };
});
vi.mock("playwright", () => ({ chromium: { launch: mocks.launch } }));
vi.mock("../shared/design-md", () => ({
  designSystemToDesignMd: () => "# Fixture design",
}));
vi.mock("../shared/extract-design-system", () => ({
  synthesizeDesignSystem: () => ({}),
}));
const { default: extract } = await import("./extract-design-md");

describe("extraction action lifecycle", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await resetMetricsForTests();
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    mocks.launch.mockResolvedValue(mocks.browser);
    mocks.browser.newContext.mockResolvedValue({
      newPage: async () => mocks.page,
    });
    mocks.page.goto.mockResolvedValue({
      status: () => 200,
      headers: () => ({ "content-type": "text/html" }),
    });
    mocks.page.evaluate
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce({ title: "Fixture", description: "" })
      .mockResolvedValueOnce(800);
    mocks.page.screenshot.mockResolvedValue(Buffer.from("image"));
  });
  afterEach(() => vi.restoreAllMocks());

  it("does not count cleanup failure as a second failed extraction", async () => {
    mocks.browser.close.mockRejectedValue(new Error("browser has been closed"));
    expect(await extract.run({ url: "example.com" })).toMatchObject({
      markdown: "# Fixture design",
    });
    const metrics = await renderPrometheusMetrics();
    expect(metrics).toContain(
      'fdmd_action_runs_total{action="extract-design-md",status="success",caller="direct"} 1',
    );
    expect(metrics).not.toContain(
      'fdmd_action_runs_total{action="extract-design-md",status="error"',
    );
    expect(metrics).toContain('kind="warning",reason="cleanup_failed"');
  });

  it("returns a complete free spec without a screenshot when both captures fail", async () => {
    mocks.page.screenshot.mockRejectedValue(new Error("Timeout exceeded"));
    expect(await extract.run({ url: "example.com" })).toMatchObject({
      markdown: "# Fixture design",
      screenshotDataUrl: "",
    });
    expect(mocks.browser.close).toHaveBeenCalledTimes(1);
    expect(await renderPrometheusMetrics()).toContain(
      'kind="warning",reason="screenshot_unavailable"',
    );
  });

  it("closes the browser and records a single error for a rejected target", async () => {
    mocks.page.goto.mockResolvedValue({
      status: () => 403,
      headers: () => ({}),
    });
    await expect(extract.run({ url: "example.com" })).rejects.toMatchObject({
      code: "access_denied",
      stage: "navigation",
    });
    expect(mocks.browser.close).toHaveBeenCalledTimes(1);
    expect(mocks.page.screenshot).not.toHaveBeenCalled();
    expect(await renderPrometheusMetrics()).toContain(
      'fdmd_action_runs_total{action="extract-design-md",status="error",caller="direct"} 1',
    );
  });

  it("rejects a private URL before starting a browser", async () => {
    await expect(extract.run({ url: "localhost" })).rejects.toMatchObject({
      code: "private_url",
    });
    expect(mocks.launch).not.toHaveBeenCalled();
  });
});
