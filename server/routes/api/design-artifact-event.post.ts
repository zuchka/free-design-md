import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { recordDesignArtifactEvent } from "../../lib/metrics.js";

const ACTIONS = new Set(["copy", "download", "share_link_copy"]);
const SOURCES = new Set(["home", "example", "saved_design", "saved_library"]);
const VARIANTS = new Set(["deterministic", "enriched", "iteration"]);
const FORMATS = new Set(["markdown", "html", "mdx", "link", "snapshot"]);

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    setResponseStatus(event, 400);
    return { error: "bad_body" };
  }

  const action = stringField(body, "action");
  const source = stringField(body, "source");
  const variant = stringField(body, "variant");
  const format = stringField(body, "format");

  if (
    !ACTIONS.has(action) ||
    !SOURCES.has(source) ||
    !VARIANTS.has(variant) ||
    !FORMATS.has(format)
  ) {
    setResponseStatus(event, 400);
    return { error: "invalid_design_artifact_event" };
  }

  await recordDesignArtifactEvent({ action, source, variant, format });
  return { ok: true };
});

function stringField(body: object, key: string): string {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
