import { defineAction } from "@agent-native/core";
import { z } from "zod";

const FeedbackCategory = z.enum([
  "something_broke",
  "wrong_output",
  "feature_request",
  "other",
]);

const InputSchema = z.object({
  category: FeedbackCategory.default("something_broke"),
  message: z.string().trim().min(3).max(4000),
  email: z.string().trim().max(320).optional(),
  pageUrl: z.string().trim().max(2048).optional(),
  sourceUrl: z.string().trim().max(2048).optional(),
  errorSource: z.string().trim().max(160).optional(),
  errorMessage: z.string().trim().max(2000).optional(),
  workflowStep: z.string().trim().max(120).optional(),
  userAgent: z.string().trim().max(600).optional(),
  viewport: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(120).optional(),
});

const CATEGORY_LABELS: Record<z.infer<typeof FeedbackCategory>, string> = {
  something_broke: "Something broke",
  wrong_output: "Wrong output",
  feature_request: "Feature request",
  other: "Other",
};

function getWebhookUrl(): string {
  const raw =
    process.env.FEEDBACK_DISCORD_WEBHOOK_URL ||
    process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  const url = raw?.trim();
  if (!url) {
    throw new Error("FEEDBACK_DISCORD_WEBHOOK_URL is not configured.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Configured Discord feedback webhook URL is invalid.");
  }

  if (
    parsed.protocol !== "https:" ||
    !["discord.com", "discordapp.com"].includes(parsed.hostname) ||
    !parsed.pathname.startsWith("/api/webhooks/")
  ) {
    throw new Error("Configured feedback webhook must be a Discord webhook.");
  }

  return url;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return trimmed || undefined;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}...`;
}

function optionalEmail(value: string | undefined): string | undefined {
  const email = clean(value);
  if (!email) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email must be valid or omitted.");
  }
  return email;
}

function addField(
  fields: Array<{ name: string; value: string; inline?: boolean }>,
  name: string,
  rawValue: string | undefined,
  inline = false,
) {
  const value = clean(rawValue);
  if (!value) return;
  fields.push({
    name,
    value: truncate(value, 1024),
    inline,
  });
}

export default defineAction({
  description:
    "Submit Free design.md product feedback or an error report to the configured Discord feedback webhook.",
  schema: InputSchema,
  readOnly: false,
  run: async (input) => {
    const webhookUrl = getWebhookUrl();
    const email = optionalEmail(input.email);
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: "Category",
        value: CATEGORY_LABELS[input.category],
        inline: true,
      },
    ];

    addField(fields, "Contact", email, true);
    addField(fields, "Workflow", input.workflowStep, true);
    addField(fields, "Page", input.pageUrl);
    addField(fields, "Submitted URL", input.sourceUrl);
    addField(fields, "Error source", input.errorSource, true);
    addField(fields, "Error", input.errorMessage);
    addField(fields, "Browser", input.userAgent);
    addField(fields, "Viewport", input.viewport, true);
    addField(fields, "Timezone", input.timezone, true);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Free design.md feedback",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title:
              input.category === "something_broke"
                ? "Feedback: something broke"
                : "Feedback",
            description: truncate(input.message, 4000),
            color:
              input.category === "something_broke" ? 0xef4444 : 0x18b6f6,
            timestamp: new Date().toISOString(),
            fields,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        body
          ? `Discord feedback webhook returned ${response.status}: ${truncate(body, 180)}`
          : `Discord feedback webhook returned ${response.status}.`,
      );
    }

    return { ok: true };
  },
});
