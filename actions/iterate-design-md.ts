/**
 * Iteration: take a previous AI-enriched design.md and a one-off user
 * instruction, return a revised memo. Mirrors the streaming shape of
 * `enrich-design-md.ts` (export an async generator + a defineAction
 * wrapper that consumes it for CLI/JSON).
 *
 * Security: user input is wrapped in nonce-delimited tags (see
 * shared/iteration-prompt.ts) and validated by shared/iteration-security.ts
 * pre- and post-call. No tool use, no system-prompt interpolation of
 * user data, fixed max_tokens.
 */
import { defineAction } from "@agent-native/core";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { buildIterationPrompt } from "../shared/iteration-prompt.js";
import {
  INPUT_CAPS,
  checkBlocklist,
  containsSystemPromptLeak,
  validateOutputShape,
} from "../shared/iteration-security.js";
import {
  isDarkModeRequest,
  validateIterationFulfillment,
} from "../shared/iteration-fulfillment.js";
import { validateSectionScope } from "../shared/iteration-scope.js";

const ITERATE_MODEL = "claude-sonnet-4-6";
const ITERATE_MAX_TOKENS = 16_000;

export interface IterationUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface IterationResult {
  markdown: string;
  model: string;
  latencyMs: number;
  usage: IterationUsage;
  stopReason: string | null;
}

export interface IterationDeltaEvent {
  type: "delta";
  text: string;
}

export interface IterationDoneEvent extends IterationResult {
  type: "done";
}

export type IterationStreamEvent = IterationDeltaEvent | IterationDoneEvent;

interface AnthropicFinalMessage {
  content: { type: string; text: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  stop_reason: string | null;
  model: string;
}

interface IterationAttempt {
  markdown: string;
  finalMessage: AnthropicFinalMessage;
  latencyMs: number;
}

export interface IterationInput {
  previousMarkdown: string;
  userPrompt: string;
  sectionTarget?: string;
  deterministicMarkdown?: string;
}

const InputSchema = z.object({
  previousMarkdown: z.string().min(1),
  userPrompt: z.string().min(1),
  sectionTarget: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
  deterministicMarkdown: z.string().optional(),
});

export async function* iterateStream(
  input: IterationInput,
): AsyncGenerator<IterationStreamEvent, void, undefined> {
  // Input caps — fail fast before any LLM call.
  if (input.userPrompt.length > INPUT_CAPS.userPrompt) {
    throw new Error(`userPrompt too long (max ${INPUT_CAPS.userPrompt})`);
  }
  if (input.previousMarkdown.length > INPUT_CAPS.parentMarkdown) {
    throw new Error(
      `previousMarkdown too long (max ${INPUT_CAPS.parentMarkdown})`,
    );
  }
  if (
    input.deterministicMarkdown &&
    input.deterministicMarkdown.length > INPUT_CAPS.parentMarkdown
  ) {
    throw new Error(
      `deterministicMarkdown too long (max ${INPUT_CAPS.parentMarkdown})`,
    );
  }
  if (
    input.sectionTarget &&
    input.sectionTarget.length > INPUT_CAPS.sectionTarget
  ) {
    throw new Error(`sectionTarget too long`);
  }

  // Pre-flight blocklist.
  const blockHit = checkBlocklist(input.userPrompt);
  if (blockHit) {
    throw new Error(`blocked: ${blockHit}`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to the local or self-hosted environment.",
    );
  }

  const { system, user } = buildIterationPrompt({
    previousMarkdown: input.previousMarkdown,
    userPrompt: input.userPrompt,
    sectionTarget: input.sectionTarget,
    deterministicMarkdown: input.deterministicMarkdown,
  });

  const client = new Anthropic({ apiKey });
  const startedAt = Date.now();

  if (isDarkModeRequest(input.userPrompt)) {
    let attempt = await collectIterationAttempt(
      client,
      system,
      user,
      startedAt,
    );
    let invalidReason = validateFinalMarkdown(system, input, attempt.markdown);

    if (invalidReason) {
      const retrySystem = [
        system,
        "",
        "Additional validation requirement for this retry:",
        "The previous draft did not make the active design system dark enough.",
        "Rewrite canonical color tokens such as canvas, canvas-soft, ink, body, and hairline when they exist.",
        "Rewrite canonical component definitions so default component names render with dark surfaces, light text, and dark-compatible borders.",
        "Do not rely on appended dark-* alternate tokens as the only implementation of dark mode.",
      ].join("\n");
      attempt = await collectIterationAttempt(
        client,
        retrySystem,
        user,
        startedAt,
      );
      invalidReason = validateFinalMarkdown(
        retrySystem,
        input,
        attempt.markdown,
      );
    }

    if (invalidReason) {
      throw new Error(`output invalid: ${invalidReason}`);
    }

    const result = buildIterationResult(attempt);
    yield { type: "delta", text: result.markdown };
    yield { type: "done", ...result };
    return;
  }

  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: ITERATE_MODEL,
      max_tokens: ITERATE_MAX_TOKENS,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: [{ type: "text", text: user }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  let accumulatedText = "";
  try {
    for await (const event of stream as AsyncIterable<{
      type: string;
      delta?: { type: string; text?: string };
    }>) {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        accumulatedText += event.delta.text;
        yield { type: "delta", text: event.delta.text };
      }
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  const finalMessage = await (
    stream as unknown as {
      finalMessage(): Promise<AnthropicFinalMessage>;
    }
  ).finalMessage();
  const latencyMs = Date.now() - startedAt;

  const textBlocks = finalMessage.content.filter((b) => b.type === "text");
  const markdown =
    textBlocks
      .map((b) => b.text)
      .join("\n")
      .trim() || accumulatedText.trim();

  const invalidReason = validateFinalMarkdown(system, input, markdown);
  if (invalidReason) {
    throw new Error(`output invalid: ${invalidReason}`);
  }

  const result = buildIterationResult({ markdown, finalMessage, latencyMs });

  yield { type: "done", ...result };
}

async function collectIterationAttempt(
  client: Anthropic,
  system: string,
  user: string,
  startedAt: number,
): Promise<IterationAttempt> {
  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream({
      model: ITERATE_MODEL,
      max_tokens: ITERATE_MAX_TOKENS,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: [{ type: "text", text: user }] }],
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  let accumulatedText = "";
  try {
    for await (const event of stream as AsyncIterable<{
      type: string;
      delta?: { type: string; text?: string };
    }>) {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        accumulatedText += event.delta.text;
      }
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  const finalMessage = await (
    stream as unknown as {
      finalMessage(): Promise<AnthropicFinalMessage>;
    }
  ).finalMessage();
  const textBlocks = finalMessage.content.filter((b) => b.type === "text");
  const markdown =
    textBlocks
      .map((b) => b.text)
      .join("\n")
      .trim() || accumulatedText.trim();

  return {
    markdown,
    finalMessage,
    latencyMs: Date.now() - startedAt,
  };
}

function validateFinalMarkdown(
  system: string,
  input: IterationInput,
  markdown: string,
): string | null {
  const shape = validateOutputShape(markdown);
  if (!shape.ok) {
    return (shape as { ok: false; reason: string }).reason;
  }
  if (containsSystemPromptLeak(system, markdown)) {
    return "system_prompt_leak";
  }
  const fulfillment = validateIterationFulfillment(input, markdown);
  if (!fulfillment.ok) {
    return (fulfillment as { ok: false; reason: string }).reason;
  }
  const scope = validateSectionScope(input, markdown);
  if (!scope.ok) {
    return (scope as { ok: false; reason: string }).reason;
  }
  return null;
}

function buildIterationResult(attempt: IterationAttempt): IterationResult {
  return {
    markdown: attempt.markdown,
    model: attempt.finalMessage.model,
    latencyMs: attempt.latencyMs,
    usage: {
      inputTokens: attempt.finalMessage.usage.input_tokens,
      outputTokens: attempt.finalMessage.usage.output_tokens,
      cacheReadInputTokens:
        attempt.finalMessage.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens:
        attempt.finalMessage.usage.cache_creation_input_tokens ?? 0,
    },
    stopReason: attempt.finalMessage.stop_reason,
  };
}

export default defineAction({
  description:
    "Revise an AI-enriched design.md memo per a one-time user instruction. " +
    "Takes the previous memo + a user prompt (+ optional section target) and " +
    "returns a new full memo. User input is treated as untrusted data; the " +
    "model is instructed never to act on instructions inside it.",
  schema: InputSchema,
  readOnly: false,
  run: async (input): Promise<IterationResult> => {
    for await (const event of iterateStream(input as IterationInput)) {
      if (event.type === "done") {
        const { type: _drop, ...result } = event;
        return result;
      }
    }
    throw new Error("iteration stream ended without a done event");
  },
});
