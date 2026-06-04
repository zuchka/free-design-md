import { parse } from "yaml";
import type { OutputCheck } from "./iteration-security";

export interface IterationScopeInput {
  previousMarkdown: string;
  sectionTarget?: string | null;
}

const SECTION_FRONTMATTER_KEYS: Record<string, string[]> = {
  colors: ["colors"],
  color: ["colors"],
  typography: ["typography"],
  type: ["typography"],
  spacing: ["spacing"],
  layout: ["spacing"],
  radii: ["rounded"],
  radius: ["rounded"],
  rounded: ["rounded"],
  "border-radii": ["rounded"],
  shapes: ["rounded"],
  shape: ["rounded"],
  components: ["components"],
  component: ["components"],
  "component-library": ["components"],
};

export function validateSectionScope(
  input: IterationScopeInput,
  outputMarkdown: string,
): OutputCheck {
  const target = input.sectionTarget?.trim();
  if (!target) return { ok: true };

  const previous = parseDesignMdParts(input.previousMarkdown);
  const next = parseDesignMdParts(outputMarkdown);
  if (!previous || !next) {
    return { ok: false, reason: "section_scope_unparseable" };
  }

  const allowedFrontmatterKeys = new Set(
    SECTION_FRONTMATTER_KEYS[target] ?? [],
  );
  const frontmatterChange = findChangedForbiddenFrontmatterKey(
    previous.frontmatter,
    next.frontmatter,
    allowedFrontmatterKeys,
  );
  if (frontmatterChange) {
    return {
      ok: false,
      reason: `section_scope_frontmatter_changed:${frontmatterChange}`,
    };
  }

  const bodyChange = findChangedForbiddenBodySection(
    previous.bodySections,
    next.bodySections,
    target,
  );
  if (bodyChange) {
    return {
      ok: false,
      reason: `section_scope_body_changed:${bodyChange}`,
    };
  }

  return { ok: true };
}

function findChangedForbiddenFrontmatterKey(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  allowedKeys: Set<string>,
): string | null {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (allowedKeys.has(key)) continue;
    if (stableJson(previous[key]) !== stableJson(next[key])) return key;
  }
  return null;
}

function findChangedForbiddenBodySection(
  previous: Map<string, string>,
  next: Map<string, string>,
  target: string,
): string | null {
  const keys = new Set([...previous.keys(), ...next.keys()]);
  for (const key of keys) {
    if (key === target) continue;
    if ((previous.get(key) ?? "") !== (next.get(key) ?? "")) return key;
  }
  return null;
}

function parseDesignMdParts(markdown: string): {
  frontmatter: Record<string, unknown>;
  bodySections: Map<string, string>;
} | null {
  const normalized = markdown.trim().replace(/\r\n/g, "\n");
  const match = normalized.match(
    /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)([\s\S]*)$/,
  );
  if (!match?.[1]) return null;

  try {
    const raw = parse(sanitizeYaml(match[1]));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return {
      frontmatter: raw as Record<string, unknown>,
      bodySections: extractBodySections(match[2] ?? ""),
    };
  } catch {
    return null;
  }
}

function sanitizeYaml(yaml: string): string {
  return yaml
    .replace(
      /^(description:\s+)([^|>"'\n].*?)(\s*)$/m,
      (_, k, v, ws) =>
        `${k}"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${ws}`,
    )
    .replace(
      /^([ \t]*\w[\w-]*:\s+)("(?:[^"\\]|\\.)*",\s*.+)$/gm,
      (_, prefix, value) => `${prefix}'${value.replace(/'/g, "\\'")}'`,
    );
}

function extractBodySections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) return sections;

  const preamble = body.slice(0, matches[0]?.index ?? 0).trim();
  if (preamble) sections.set("__preamble", preamble);

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const title = match[1]?.trim() ?? "";
    const slug = slugifySection(title);
    if (!slug || match.index === undefined) continue;
    const next = matches[i + 1]?.index ?? body.length;
    sections.set(slug, body.slice(match.index, next).trimEnd());
  }

  return sections;
}

function slugifySection(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
