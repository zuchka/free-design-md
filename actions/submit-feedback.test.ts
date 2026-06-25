import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import submitFeedback from "./submit-feedback";

const ORIGINAL_FEEDBACK_WEBHOOK = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
const ORIGINAL_DISCORD_WEBHOOK = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;

describe("submit-feedback action", () => {
  beforeEach(() => {
    process.env.FEEDBACK_DISCORD_WEBHOOK_URL =
      "https://discord.com/api/webhooks/123/token";
    delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  });

  afterEach(() => {
    if (ORIGINAL_FEEDBACK_WEBHOOK === undefined) {
      delete process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
    } else {
      process.env.FEEDBACK_DISCORD_WEBHOOK_URL = ORIGINAL_FEEDBACK_WEBHOOK;
    }
    if (ORIGINAL_DISCORD_WEBHOOK === undefined) {
      delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    } else {
      process.env.DISCORD_FEEDBACK_WEBHOOK_URL = ORIGINAL_DISCORD_WEBHOOK;
    }
    vi.restoreAllMocks();
  });

  it("posts feedback to Discord without requiring email", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await submitFeedback.run({
      category: "something_broke",
      message: "Extraction failed after clicking the button.",
      pageUrl: "https://freedesign.md/?url=https%3A%2F%2Fstripe.com",
      sourceUrl: "https://stripe.com",
      errorSource: "GET /api/extract",
      errorMessage: "Request failed with 500",
      workflowStep: "Extraction",
      userAgent: "Test Browser",
      viewport: "1280x720",
      timezone: "America/Los_Angeles",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/123/token");
    expect(init?.method).toBe("POST");

    const body = JSON.parse(String(init?.body)) as {
      allowed_mentions: { parse: string[] };
      embeds: Array<{
        description: string;
        fields: Array<{ name: string; value: string }>;
      }>;
    };
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0].description).toContain("Extraction failed");
    expect(body.embeds[0].fields.map((field) => field.name)).not.toContain(
      "Contact",
    );
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Error",
          value: "Request failed with 500",
        }),
      ]),
    );
  });

  it("rejects when the Discord webhook is not configured", async () => {
    delete process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
    delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      submitFeedback.run({
        category: "other",
        message: "The button did not respond.",
      }),
    ).rejects.toThrow("FEEDBACK_DISCORD_WEBHOOK_URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
