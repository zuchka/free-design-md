import { parseEnrichedFrontmatter } from "./parse-enriched-design-md";
import type { OutputCheck } from "./iteration-security";

export interface IterationFulfillmentInput {
  previousMarkdown: string;
  userPrompt: string;
  sectionTarget?: string | null;
}

const DARK_MODE_RE =
  /\b(dark\s*(mode|theme|version|variant)|night\s*(mode|theme)|make\s+(it|this|the\s+(system|design|memo))\s+dark|turn\s+(it|this|the\s+(system|design|memo))\s+(into\s+)?(a\s+)?dark)\b/i;

const SURFACE_KEYS = [
  "canvas",
  "background",
  "page-bg",
  "page-background",
  "surface",
  "surface-default",
  "canvas-soft",
  "card-bg",
  "card-background",
] as const;

const TEXT_KEYS = [
  "ink",
  "body",
  "text",
  "foreground",
  "on-canvas",
  "on-background",
] as const;

export function validateIterationFulfillment(
  input: IterationFulfillmentInput,
  outputMarkdown: string,
): OutputCheck {
  if (!isDarkModeRequest(input.userPrompt)) {
    return { ok: true };
  }

  const previous = parseEnrichedFrontmatter(input.previousMarkdown);
  const next = parseEnrichedFrontmatter(outputMarkdown);
  if (!previous || !next) {
    return { ok: true };
  }

  const canonicalSurfaceKeys = SURFACE_KEYS.filter((key) =>
    isLightColor(previous.colors[key]),
  );
  const surfaceChanged =
    canonicalSurfaceKeys.length === 0 ||
    canonicalSurfaceKeys.some((key) => isDarkColor(next.colors[key]));

  if (!surfaceChanged) {
    return {
      ok: false,
      reason: hasDarkAlternateAdditions(previous, next)
        ? "dark_mode_added_alternate_tokens_only"
        : "dark_mode_canonical_surfaces_unchanged",
    };
  }

  const canonicalTextKeys = TEXT_KEYS.filter((key) =>
    isDarkColor(previous.colors[key]),
  );
  const textChanged =
    canonicalTextKeys.length === 0 ||
    canonicalTextKeys.some((key) => isLightColor(next.colors[key]));

  if (!textChanged) {
    return { ok: false, reason: "dark_mode_canonical_text_unchanged" };
  }

  return { ok: true };
}

export function isDarkModeRequest(prompt: string): boolean {
  return DARK_MODE_RE.test(prompt);
}

function hasDarkAlternateAdditions(
  previous: NonNullable<ReturnType<typeof parseEnrichedFrontmatter>>,
  next: NonNullable<ReturnType<typeof parseEnrichedFrontmatter>>,
): boolean {
  const previousColorKeys = new Set(Object.keys(previous.colors));
  const previousComponentKeys = new Set(Object.keys(previous.components));

  return (
    Object.keys(next.colors).some(
      (key) => key.startsWith("dark-") && !previousColorKeys.has(key),
    ) ||
    Object.keys(next.components).some(
      (key) => key.startsWith("dark-") && !previousComponentKeys.has(key),
    )
  );
}

function isLightColor(value: string | undefined): boolean {
  const rgb = parseHexColor(value);
  return rgb ? relativeLuminance(rgb) >= 0.72 : false;
}

function isDarkColor(value: string | undefined): boolean {
  const rgb = parseHexColor(value);
  return rgb ? relativeLuminance(rgb) <= 0.32 : false;
}

function parseHexColor(
  value: string | undefined,
): [number, number, number] | null {
  if (!value) return null;
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match?.[1]) return null;

  const hex =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : match[1];

  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
