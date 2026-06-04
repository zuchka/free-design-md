import { parse, stringify } from "yaml";
import type { DesignSystemData } from "./api";

const FRONTMATTER_RE = /(?:^|\n)---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
const SAFE_RADIUS = /^\d+(\.\d+)?(px|rem|em|%)$/;
const BUTTON_COMPONENT_RE =
  /(^|[-_\s])(button|btn|cta)([-_\s]|$)|nav-cta|sign[-_\s]?up|get[-_\s]?started|contact[-_\s]?sales/i;

export function deterministicButtonRadius(
  data: unknown,
): string | null {
  if (!isRecord(data)) return null;
  const designSystem = data as Partial<DesignSystemData>;
  const componentRadius =
    designSystem.components?.button?.primary?.radius?.trim() ?? "";
  const semanticRadius = designSystem.borders?.radii?.button?.trim() ?? "";
  const radius = componentRadius || semanticRadius;
  return SAFE_RADIUS.test(radius) ? radius : null;
}

export function applyDeterministicRadiusFidelity(
  markdown: string,
  data: unknown,
): string {
  const radius = deterministicButtonRadius(data);
  if (!radius) return markdown;

  const content = stripFence(markdown);
  const match = FRONTMATTER_RE.exec(content);
  if (!match?.[1]) return markdown;

  let parsed: unknown;
  try {
    parsed = parse(match[1]);
  } catch {
    return markdown;
  }
  if (!isRecord(parsed)) return markdown;

  const rounded = ensureRecord(parsed.rounded);
  rounded.button = radius;
  parsed.rounded = rounded;

  const components = ensureRecord(parsed.components);
  for (const [name, value] of Object.entries(components)) {
    if (!isRecord(value) || !isButtonComponent(name, value)) continue;
    const prop = radiusPropFor(value);
    value[prop] = "{rounded.button}";
  }
  parsed.components = components;

  const bodyStart = match.index + match[0].length;
  const body = content.slice(bodyStart);
  const yaml = stringify(parsed, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---${body.startsWith("\n") ? body : `\n${body}`}`.trimEnd() + "\n";
}

function stripFence(markdown: string): string {
  const trimmed = markdown.trim();
  const fenceMatch = trimmed.match(
    /^```(?:markdown|yaml)?\s*\n([\s\S]*?)\n```\s*$/,
  );
  return fenceMatch?.[1]?.trim() ?? markdown;
}

function ensureRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isButtonComponent(
  name: string,
  props: Record<string, unknown>,
): boolean {
  if (BUTTON_COMPONENT_RE.test(name)) return true;
  const hasButtonShape =
    typeof props.backgroundColor === "string" &&
    typeof props.color === "string" &&
    typeof props.padding === "string";
  const hasRadiusProp =
    typeof props.borderRadius === "string" ||
    typeof props.rounded === "string" ||
    typeof props.radius === "string";
  return hasButtonShape && hasRadiusProp;
}

function radiusPropFor(props: Record<string, unknown>): string {
  if (typeof props.borderRadius === "string") return "borderRadius";
  if (typeof props.rounded === "string") return "rounded";
  if (typeof props.radius === "string") return "radius";
  return "rounded";
}
