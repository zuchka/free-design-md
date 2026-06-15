import { describe, expect, it } from "vitest";
import {
  classifyAiAccessErrorMessage,
  classifyAiAccessErrorPayload,
  formatAiAccessError,
  readAiAccessErrorResponse,
} from "./ai-access-errors";

describe("AI access error helpers", () => {
  it("classifies quota payloads as recoverable", () => {
    expect(classifyAiAccessErrorPayload({ error: "out_of_credits" })).toBe(
      "out_of_credits",
    );
  });

  it("classifies compact route error strings", () => {
    expect(
      classifyAiAccessErrorMessage(
        "out_of_credits:signed-in-and-out-of-credits",
      ),
    ).toBe("out_of_credits");
  });

  it("formats known API errors as user-facing copy", () => {
    expect(formatAiAccessError({ error: "no_api_key_available" })).toContain(
      "not configured",
    );
  });

  it("reads JSON error responses without exposing raw JSON", async () => {
    const response = new Response(
      JSON.stringify({
        error: "out_of_credits",
        reason: "signed-in-and-out-of-credits",
      }),
      { status: 402 },
    );

    await expect(
      readAiAccessErrorResponse(response, "failed"),
    ).resolves.toEqual({
      message: "You've used all available AI credits.",
      recoveryReason: "out_of_credits",
    });
  });
});
