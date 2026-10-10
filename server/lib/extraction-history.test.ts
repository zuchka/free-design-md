import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractionHistoryUrl,
  recordExtractionHistory,
} from "./extraction-history";

const execute = vi.hoisted(() => vi.fn());
vi.mock("../db/client.js", () => ({ getDbExec: () => ({ execute }) }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  execute.mockReset();
});

describe("extraction URL history", () => {
  it.each([
    ["Example.com/pricing", "https://example.com/pricing"],
    ["example.com:8080/pricing", "https://example.com:8080/pricing"],
    ["http:example.com/pricing", "http://example.com/pricing"],
    ["mailto:name@example.com", null],
    ["http://example.com:8080/docs", "http://example.com:8080/docs"],
    [
      "https://user:password@example.com/page?token=secret&redirect=https://private.test#secret",
      "https://example.com/page",
    ],
    ["https://example.com/a%20page", "https://example.com/a%20page"],
    ["https://missing.example/path", "https://missing.example/path"],
    ["not a URL?token=secret", null],
    ["ftp://example.com/private", null],
    ["", null],
    [undefined, null],
    [["https://example.com"], null],
    [`https://example.com/${"x".repeat(2048)}`, null],
  ])("sanitizes %s", (input, expected) => {
    expect(extractionHistoryUrl(input)).toBe(expected);
  });

  it("does not fail extraction or log query parameters when storage fails", async () => {
    vi.stubEnv("DATABASE_TESTS", "true");
    execute.mockRejectedValue(
      new Error("database error includes secret URL parameter"),
    );
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(
      recordExtractionHistory({
        requestId: "00000000-0000-0000-0000-000000000001",
        url: "https://example.com/page?token=secret",
        status: "error",
        code: "dns",
        stage: "navigation",
        caller: "http",
        retried: false,
        durationMs: 100,
        upstreamStatus: null,
      }),
    ).resolves.toBeUndefined();
    expect(execute.mock.calls[0][0].args[1]).toBe("https://example.com/page");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
  });
});
