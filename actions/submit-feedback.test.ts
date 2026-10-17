import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import submitFeedback from "./submit-feedback";

const ORIGINAL_FEEDBACK_WEBHOOK = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
const ORIGINAL_DISCORD_WEBHOOK = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
const ORIGINAL_SLACK_WEBHOOK = process.env.FEEDBACK_SLACK_WEBHOOK_URL;

describe("submit-feedback action", () => {
  beforeEach(() => {
    process.env.FEEDBACK_DISCORD_WEBHOOK_URL =
      "https://discord.com/api/webhooks/123/token";
    delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    delete process.env.FEEDBACK_SLACK_WEBHOOK_URL;
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
    if (ORIGINAL_SLACK_WEBHOOK === undefined) {
      delete process.env.FEEDBACK_SLACK_WEBHOOK_URL;
    } else {
      process.env.FEEDBACK_SLACK_WEBHOOK_URL = ORIGINAL_SLACK_WEBHOOK;
    }
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
    ).rejects.toThrow("feedback webhook is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers Slack and preserves long feedback as plain text without mentions", async () => {
    process.env.FEEDBACK_SLACK_WEBHOOK_URL =
      "https://hooks.slack.com/services/T123/B123/testToken";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    const message = "<!channel> <@U123> & report " + "a".repeat(3900);
    await submitFeedback.run({
      category: "other",
      message,
      email: "feedback@example.com",
      errorMessage: "<broken>",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(process.env.FEEDBACK_SLACK_WEBHOOK_URL);
    expect(init?.redirect).toBe("error");
    const payload = JSON.parse(String(init?.body));
    expect(payload.text).toBe("Free design.md feedback: Other");
    expect(payload.unfurl_links).toBe(false);
    const sections = payload.blocks.filter(
      (block: { text?: { type: string }; type: string }) =>
        block.type === "section" && block.text,
    );
    expect(
      sections
        .map((block: { text: { text: string } }) => block.text.text)
        .join(""),
    ).toBe(message);
    for (const block of sections) {
      expect(block.text.type).toBe("plain_text");
      expect(block.text.text.length).toBeLessThanOrEqual(3000);
    }
    expect(payload.blocks.at(-1).fields).toEqual(
      expect.arrayContaining([
        {
          type: "plain_text",
          text: "Contact\nfeedback@example.com",
          emoji: false,
        },
        { type: "plain_text", text: "Error\n<broken>", emoji: false },
      ]),
    );
  });

  it.each([
    "http://hooks.slack.com/services/T1/B1/token",
    "https://hooks.slack.com.evil.example/services/T1/B1/token",
    "https://example.com/services/T1/B1/token",
    "https://hooks.slack.com/anything",
    "https://name:password@hooks.slack.com/services/T1/B1/token",
    "https://hooks.slack.com/services/T1/B1/token?secret=value",
  ])("rejects an invalid Slack destination: %s", async (url) => {
    process.env.FEEDBACK_SLACK_WEBHOOK_URL = url;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      submitFeedback.run({ category: "other", message: "Test feedback" }),
    ).rejects.toThrow("must be a Slack webhook");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a delivery failure without exposing upstream response details", async () => {
    process.env.FEEDBACK_SLACK_WEBHOOK_URL =
      "https://hooks.slack.com/services/T123/B123/testToken";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("private response details", { status: 403 }),
    );
    await expect(
      submitFeedback.run({ category: "other", message: "Test feedback" }),
    ).rejects.toThrow("Slack feedback webhook returned 403.");
  });
});
