import { defineEventHandler, getMethod, readBody, setResponseStatus } from "h3";
import { appStateGet, appStatePut } from "@agent-native/core/application-state";
import { resolveAgentContextOwner } from "../../lib/owner.js";

const MAX_MARKDOWN_CHARS = 200_000;

function stringValue(value: unknown, max = MAX_MARKDOWN_CHARS): string | null {
  if (typeof value !== "string") return null;
  return value.length <= max ? value : value.slice(0, max);
}

export default defineEventHandler(async (event) => {
  const owner = await resolveAgentContextOwner(event);
  const method = getMethod(event);

  if (method === "GET") {
    return (await appStateGet(owner, "navigation")) ?? null;
  }

  if (method !== "POST") {
    setResponseStatus(event, 405);
    return { error: "Method not allowed" };
  }

  const body = (await readBody(event).catch(() => null)) as Record<
    string,
    unknown
  > | null;

  const currentMarkdown = stringValue(body?.currentMarkdown);
  const url = stringValue(body?.url, 2048);
  if (!body || !url || !currentMarkdown) {
    setResponseStatus(event, 400);
    return { error: "url and currentMarkdown are required" };
  }

  const payload = {
    view: "design-md",
    url,
    title: stringValue(body.title, 512) ?? url,
    stage: stringValue(body.stage, 64) ?? "deterministic",
    savedDesignId: stringValue(body.savedDesignId, 256),
    savedDesignUrl: stringValue(body.savedDesignUrl, 2048),
    updatedAt: stringValue(body.updatedAt, 64) ?? new Date().toISOString(),
    currentMarkdown,
    currentMarkdownPreview:
      stringValue(body.currentMarkdownPreview, 12_000) ?? currentMarkdown,
    deterministicMarkdown:
      stringValue(body.deterministicMarkdown) ?? currentMarkdown,
    designSystemData:
      body.designSystemData &&
      typeof body.designSystemData === "object" &&
      !Array.isArray(body.designSystemData)
        ? body.designSystemData
        : null,
    instructions:
      "Use currentMarkdown as the loaded design.md. Do not ask the user to paste or enrich the URL again.",
  };

  await appStatePut(owner, "navigation", payload, {
    requestSource: "free-design-md",
  });

  return payload;
});
