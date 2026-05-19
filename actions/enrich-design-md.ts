/**
 * AI-enrichment: take the deterministic DesignSystemData + screenshot
 * + deterministic markdown produced by `extract-design-md`, send them to
 * Claude Opus 4.7 with a schema reference (VoltAgent's MIT-licensed
 * Vercel DESIGN.md), and return a richer DESIGN.md following the Google
 * Stitch schema.
 *
 * Phase 2 changes vs. the spike:
 * - Streamed output (messages.stream) so the UI can render deltas as
 *   they arrive instead of blocking ~30-60s on a single response.
 * - max_tokens bumped from 16K → 32K so Linear-class rich brands no
 *   longer hit `stop_reason: "max_tokens"` truncation.
 * - System prompt sent as content blocks with cache_control:ephemeral
 *   for prompt caching on the ~40 KB VoltAgent reference.
 *
 * The action layer's `run()` consumes the stream and returns a single
 * result so CLI invocations (pnpm action enrich-design-md ...) still
 * see the existing shape. The HTTP endpoint imports `enrichStream`
 * directly and forwards each delta as an SSE event.
 */
import { defineAction } from "@agent-native/core";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { buildEnrichmentPrompt, PROMPT_VERSION } from "./enrich-prompt.js";
import { getDb, schema } from "../server/db/index.js";
import { useDemoBrandCache } from "../shared/flags.js";
import type { DesignSystemData } from "../shared/api.js";
import type { ExtractedSignals } from "../shared/extract-design-system.js";

const ENRICH_MODEL = "claude-sonnet-4-6";
const ENRICH_MAX_TOKENS = 64000;

export interface EnrichUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface EnrichResult {
  url: string;
  markdown: string;
  model: string;
  latencyMs: number;
  usage: EnrichUsage;
  stopReason: string | null;
}

export interface EnrichDeltaEvent {
  type: "delta";
  text: string;
}

export interface EnrichDoneEvent extends EnrichResult {
  type: "done";
}

export type EnrichStreamEvent = EnrichDeltaEvent | EnrichDoneEvent;

export interface EnrichInput {
  url: string;
  designSystemData: unknown;
  deterministicMarkdown: string;
  signals: unknown;
  screenshotDataUrl: string;
}

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
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "voltagent-vercel-reference.md");
  return readFileSync(path, "utf8");
}

function cacheKey(url: string): string {
  return `${url}::${PROMPT_VERSION}`;
}

/**
 * Look up a cached enrichment by (url, PROMPT_VERSION). Returns null on
 * miss. Wrapped in try/catch so a transient DB error never blocks a
 * live LLM call.
 */
async function readCache(url: string): Promise<EnrichResult | null> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.enrichmentCache)
      .where(eq(schema.enrichmentCache.cacheKey, cacheKey(url)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      url: row.url,
      markdown: row.markdown,
      model: row.model,
      latencyMs: 0,
      usage: JSON.parse(row.usageJson) as EnrichUsage,
      stopReason: row.stopReason ?? "end_turn",
    };
  } catch {
    return null;
  }
}

/**
 * Persist a successful enrichment to the cache. Errors are swallowed —
 * a write failure shouldn't block the result reaching the user.
 */
async function writeCache(result: EnrichResult): Promise<void> {
  try {
    const db = await getDb();
    await db
      .insert(schema.enrichmentCache)
      .values({
        cacheKey: cacheKey(result.url),
        url: result.url,
        promptVersion: PROMPT_VERSION,
        markdown: result.markdown,
        model: result.model,
        usageJson: JSON.stringify(result.usage),
        stopReason: result.stopReason,
      })
      .onConflictDoUpdate({
        target: schema.enrichmentCache.cacheKey,
        set: {
          markdown: result.markdown,
          model: result.model,
          usageJson: JSON.stringify(result.usage),
          stopReason: result.stopReason,
        },
      });
  } catch {
    // ignore — see writeCache JSDoc
  }
}

/**
 * Stream enrichment events from Anthropic. Yields `delta` events for
 * each text chunk and a final `done` event with the full markdown plus
 * usage stats. Used directly by the SSE endpoint; consumed eagerly by
 * the action's run() for the CLI / JSON path.
 */
export async function* enrichStream(
  input: EnrichInput,
): AsyncGenerator<EnrichStreamEvent, void, undefined> {
  // Cache short-circuit. Returns the cached result as a single `done`
  // event with no streaming deltas — the UI handles that naturally
  // (the AI-enriched pane fills in instantly).
  if (useDemoBrandCache()) {
    const cached = await readCache(input.url);
    if (cached) {
      yield { type: "done", ...cached };
      return;
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable AI enrichment.",
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

  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: ENRICH_MODEL,
      max_tokens: ENRICH_MAX_TOKENS,
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
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  let accumulatedText = "";
  try {
    for await (const event of stream) {
      // We only stream user-facing text. Thinking deltas are dropped —
      // they're visible in the SDK stream but not surfaced in the UI.
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        accumulatedText += text;
        yield { type: "delta", text };
      }
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  const finalMessage = await stream.finalMessage();
  const latencyMs = Date.now() - startedAt;

  // Prefer the SDK's accumulated text. Fall back to our local accumulator
  // if for any reason the final message's text blocks come back empty.
  const textBlocks = finalMessage.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  const markdown =
    textBlocks
      .map((b) => b.text)
      .join("\n")
      .trim() || accumulatedText.trim();

  if (!markdown) {
    throw new Error(
      "Enrichment returned no text content. Stop reason: " +
        (finalMessage.stop_reason ?? "unknown"),
    );
  }

  const result: EnrichResult = {
    url: input.url,
    markdown,
    model: finalMessage.model,
    latencyMs,
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      cacheReadInputTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens:
        finalMessage.usage.cache_creation_input_tokens ?? 0,
    },
    stopReason: finalMessage.stop_reason,
  };

  // Persist for future hits. Failures are swallowed — the user still
  // got their enrichment.
  await writeCache(result);

  yield { type: "done", ...result };
}

export default defineAction({
  description:
    "AI-enrich a deterministic design.md extraction using Claude Opus 4.7. " +
    "Takes the output of extract-design-md (signals + markdown + screenshot) " +
    "and returns a richer DESIGN.md following the Google Stitch / VoltAgent " +
    "schema. Streams internally; the CLI/JSON path returns the final result " +
    "as a single object.",
  schema: z.object({
    url: z.string(),
    designSystemData: z.unknown(),
    deterministicMarkdown: z.string(),
    signals: z.unknown(),
    screenshotDataUrl: z.string(),
  }),
  readOnly: true,
  run: async (input): Promise<EnrichResult> => {
    for await (const event of enrichStream(input as EnrichInput)) {
      if (event.type === "done") {
        const { type: _drop, ...result } = event;
        return result;
      }
    }
    throw new Error("enrichment stream ended without a done event");
  },
});
