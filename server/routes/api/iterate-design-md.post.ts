import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import { randomUUID } from "node:crypto";
import { getDbExec } from "@agent-native/core/db";
import {
  iterateStream,
  type IterationInput,
} from "../../../actions/iterate-design-md.js";
import { resolveOwner } from "../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../lib/quota.js";
import {
  INPUT_CAPS,
  checkBlocklist,
} from "../../../shared/iteration-security.js";

const SECTION_RE = /^[a-z0-9-]{1,40}$/;

/**
 * POST /api/iterate-design-md (SSE)
 *
 * Revises an AI-enriched design.md per a one-off user instruction.
 * Each successful iteration consumes 1 credit from the app-wide
 * `fdmd_quota` row keyed on the resolved owner.
 *
 * Body: { sessionId, previousMarkdown, userPrompt, url?, sectionTarget?, parentId? }
 * Response: text/event-stream with delta/done/error events.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    return { error: "bad_body" };
  }

  const previousMarkdown =
    typeof (body as Record<string, unknown>).previousMarkdown === "string"
      ? ((body as Record<string, unknown>).previousMarkdown as string)
      : null;
  const userPrompt =
    typeof (body as Record<string, unknown>).userPrompt === "string"
      ? ((body as Record<string, unknown>).userPrompt as string)
      : null;
  const sessionId =
    typeof (body as Record<string, unknown>).sessionId === "string"
      ? ((body as Record<string, unknown>).sessionId as string)
      : null;
  const sectionTarget =
    typeof (body as Record<string, unknown>).sectionTarget === "string"
      ? ((body as Record<string, unknown>).sectionTarget as string)
      : null;
  const parentId =
    typeof (body as Record<string, unknown>).parentId === "string"
      ? ((body as Record<string, unknown>).parentId as string)
      : null;
  const url =
    typeof (body as Record<string, unknown>).url === "string"
      ? ((body as Record<string, unknown>).url as string)
      : "";

  if (!previousMarkdown || !userPrompt || !sessionId) {
    setResponseStatus(event, 400);
    return { error: "missing_fields" };
  }
  if (previousMarkdown.length > INPUT_CAPS.parentMarkdown) {
    setResponseStatus(event, 400);
    return { error: "previousMarkdown_too_long" };
  }
  if (userPrompt.length > INPUT_CAPS.userPrompt) {
    setResponseStatus(event, 400);
    return { error: "userPrompt_too_long" };
  }
  if (sectionTarget && !SECTION_RE.test(sectionTarget)) {
    setResponseStatus(event, 400);
    return { error: "bad_section_target" };
  }

  const owner = await resolveOwner(event);

  // Pre-flight blocklist BEFORE any quota spend — jailbreaks are free to attempt
  // and free to record, but never cost a credit.
  const blockHit = checkBlocklist(userPrompt);
  if (blockHit) {
    await insertRejected({
      sessionId,
      parentId,
      url,
      owner,
      userPrompt,
      sectionTarget,
      rejectedReason: `blocklist:${blockHit}`,
    });
    setResponseStatus(event, 422);
    return { error: "blocked", reason: blockHit };
  }

  // Atomic quota decrement before streaming.
  const dec = await decrementCredits(owner);
  if (!dec.ok) {
    setResponseStatus(event, 402);
    return { error: "out_of_credits" };
  }

  setResponseHeader(event, "Content-Type", "text/event-stream; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "no-cache, no-transform");
  setResponseHeader(event, "Connection", "keep-alive");
  setResponseHeader(event, "X-Accel-Buffering", "no");

  const id = randomUUID();
  const input: IterationInput = {
    previousMarkdown,
    userPrompt,
    sectionTarget: sectionTarget ?? undefined,
  };

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (name: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      try {
        for await (const ev of iterateStream(input)) {
          if (ev.type === "delta") {
            send("delta", { text: ev.text });
          } else {
            // done
            const { type: _drop, ...result } = ev;
            await insertSuccess({
              id,
              sessionId,
              parentId,
              url,
              owner,
              userPrompt,
              sectionTarget,
              result,
            });
            send("done", { id, ...result, remaining: dec.remaining });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await refundCredit(owner).catch(() => {});
        await insertRejected({
          sessionId,
          parentId,
          url,
          owner,
          userPrompt,
          sectionTarget,
          rejectedReason: message.slice(0, 200),
        }).catch(() => {});
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });
});

interface SuccessArgs {
  id: string;
  sessionId: string;
  parentId: string | null;
  url: string;
  owner: string;
  userPrompt: string;
  sectionTarget: string | null;
  result: {
    markdown: string;
    model: string;
    usage: unknown;
    stopReason: string | null;
  };
}

async function insertSuccess(a: SuccessArgs): Promise<void> {
  const exec = getDbExec();
  await exec.execute({
    sql: `INSERT INTO fdmd_iterations
          (id, session_id, parent_id, url, owner, user_prompt, section_target,
           markdown, model, usage_json, stop_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      a.id,
      a.sessionId,
      a.parentId,
      a.url,
      a.owner,
      a.userPrompt,
      a.sectionTarget,
      a.result.markdown,
      a.result.model,
      JSON.stringify(a.result.usage),
      a.result.stopReason,
    ],
  });
}

interface RejectedArgs {
  sessionId: string;
  parentId: string | null;
  url: string;
  owner: string;
  userPrompt: string;
  sectionTarget: string | null;
  rejectedReason: string;
}

async function insertRejected(a: RejectedArgs): Promise<void> {
  const exec = getDbExec();
  await exec.execute({
    sql: `INSERT INTO fdmd_iterations
          (id, session_id, parent_id, url, owner, user_prompt, section_target,
           markdown, model, rejected_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
    args: [
      randomUUID(),
      a.sessionId,
      a.parentId,
      a.url,
      a.owner,
      a.userPrompt,
      a.sectionTarget,
      a.rejectedReason,
    ],
  });
}
