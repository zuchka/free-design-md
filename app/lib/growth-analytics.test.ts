// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe("browser telemetry lifecycle", () => {
  it("shares bootstrap and serializes an auth refresh behind the first cookie response", async () => {
    let finish!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetch = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(Response.json({ enabled: true }));
    vi.stubGlobal("fetch", fetch);
    const { ensureAnalyticsVisitor, resetAnalyticsVisitor } = await import(
      "./growth-analytics"
    );
    const first = ensureAnalyticsVisitor();
    expect(ensureAnalyticsVisitor()).toBe(first);
    resetAnalyticsVisitor();
    const refreshed = ensureAnalyticsVisitor();
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(Response.json({ enabled: true }));
    expect(await refreshed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("stops product events when disabled while preserving the existing artifact counter", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ enabled: false }));
    vi.stubGlobal("fetch", fetch);
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: beacon,
      configurable: true,
    });
    const { emitGrowthEvent } = await import("./growth-analytics");
    await emitGrowthEvent({ name: "page_viewed" });
    expect(beacon).not.toHaveBeenCalled();
    await emitGrowthEvent(
      { name: "artifact_copied", artifactId: "request-reference" },
      true,
    );
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});
