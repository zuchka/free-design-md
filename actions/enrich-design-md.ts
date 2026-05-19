/**
 * AI-enrichment spike: take the deterministic DesignSystemData + screenshot
 * + deterministic markdown produced by `extract-design-md`, send them to
 * Claude Opus 4.7 with a schema reference (VoltAgent's MIT-licensed
 * Vercel DESIGN.md), and return a richer DESIGN.md following the Google
 * Stitch schema.
 *
 * This is a research spike. No auth, no caching, no streaming, no
 * multi-provider fallback, no agent-native LLM abstraction. Just a
 * direct SDK call against ANTHROPIC_API_KEY from the env.
 */
import { defineAction } from "@agent-native/core";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildEnrichmentPrompt } from "./enrich-prompt.js";
import type { DesignSystemData } from "../shared/api.js";
import type { ExtractedSignals } from "../shared/extract-design-system.js";

const ENRICH_MODEL = "claude-opus-4-7";
const ENRICH_MAX_TOKENS = 16000;

/**
 * Strip the `data:image/png;base64,` prefix from a data URL and return the
 * raw base64 payload + media type. Anthropic's vision content block expects
 * a media_type + base64 data, not a data URL.
 */
function parseDataUrl(dataUrl: string): {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
} {
  const m = dataUrl.match(
    /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/,
  );
  if (!m || !m[1] || !m[2]) {
    throw new Error(
      "screenshotDataUrl must be a base64 data URL of a supported image type",
    );
  }
  return {
    mediaType: m[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
    data: m[2],
  };
}

function loadVoltAgentReference(): string {
  // The reference .md lives alongside this action file in actions/.
  // Resolve relative to this module's URL so it works regardless of CWD.
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "voltagent-vercel-reference.md");
  return readFileSync(path, "utf8");
}

export default defineAction({
  description:
    "AI-enrich a deterministic design.md extraction using Claude Opus 4.7. " +
    "Takes the output of extract-design-md (signals + markdown + screenshot) " +
    "and returns a richer DESIGN.md following the Google Stitch / VoltAgent " +
    "schema. Spike — direct ANTHROPIC_API_KEY, no caching.",
  schema: z.object({
    url: z.string(),
    designSystemData: z.unknown(),
    deterministicMarkdown: z.string(),
    signals: z.unknown(),
    screenshotDataUrl: z.string(),
  }),
  readOnly: true,
  run: async (input) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local to run the AI enrichment spike.",
      );
    }

    const schemaReference = loadVoltAgentReference();
    const { systemBlocks, userText } = buildEnrichmentPrompt({
      url: input.url,
      designSystemData: input.designSystemData as DesignSystemData,
      deterministicMarkdown: input.deterministicMarkdown,
      signals: input.signals as ExtractedSignals,
      schemaReference,
    });

    const { mediaType, data: imageData } = parseDataUrl(input.screenshotDataUrl);

    const client = new Anthropic();

    const startedAt = Date.now();
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: ENRICH_MODEL,
        max_tokens: ENRICH_MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: systemBlocks,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageData },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      });
    } catch (err) {
      // Hard-fail loudly — this is a spike. We want to see what broke.
      if (err instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
      }
      throw err;
    }
    const latencyMs = Date.now() - startedAt;

    // The response is a list of content blocks. For our prompt the model
    // returns one text block (plus possibly empty thinking blocks). Pull
    // out the text.
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const markdown = textBlocks.map((b) => b.text).join("\n").trim();
    if (!markdown) {
      throw new Error(
        "Enrichment returned no text content. Stop reason: " +
          (response.stop_reason ?? "unknown"),
      );
    }

    return {
      url: input.url,
      markdown,
      model: response.model,
      latencyMs,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
      stopReason: response.stop_reason,
    };
  },
});
