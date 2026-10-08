import { describe, expect, it } from "vitest";
import { readExtractionError } from "./extraction-errors";

describe("extraction error responses", () => {
  it("preserves the reference and recovery reason, using known safe copy", async () => {
    const response = Response.json(
      {
        error: {
          code: "dns",
          message: "raw-secret",
          hint: "raw-secret",
          retryable: true,
          stage: "navigation",
          requestId: "test-reference",
        },
      },
      { status: 422 },
    );
    const error = await readExtractionError(response);
    expect(error.detail).toMatchObject({
      code: "dns",
      retryable: false,
      requestId: "test-reference",
    });
    expect(error.message).not.toContain("raw-secret");
  });
  it.each([
    "<html>upstream error secret</html>",
    "extraction failed: secret",
    '{"error":{"code":"unrecognized","message":"secret"}}',
  ])(
    "handles proxies and older text responses without showing raw content",
    async (body) => {
      const error = await readExtractionError(
        new Response(body, {
          status: 502,
          headers: { "X-Request-Id": "reference" },
        }),
      );
      expect(error.detail.requestId).toBe("reference");
      expect(error.message).not.toContain("secret");
    },
  );
});
