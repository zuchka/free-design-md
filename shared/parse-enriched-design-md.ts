import { parse } from "yaml";

export interface EnrichedTypographyScale {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

export interface EnrichedFrontmatter {
  version?: string;
  name?: string;
  description?: string;
  colors: Record<string, string>;
  typography: Record<string, EnrichedTypographyScale>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
  components: Record<string, Record<string, string>>;
}

export function parseEnrichedFrontmatter(markdown: string): EnrichedFrontmatter | null {
  let content = markdown.trim();

  // Strip optional markdown/yaml code fence wrapper — LLMs sometimes add these
  // despite prompt instructions when using extended thinking.
  const fenceMatch = content.match(/^```(?:markdown|yaml)?\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch?.[1]) content = fenceMatch[1].trim();

  // Find the first YAML frontmatter block. Allow optional preamble before ---
  // (extended thinking models occasionally emit a brief line before the delimiter).
  const match = content.match(/(?:^|\n)---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match?.[1]) return null;
  try {
    const raw = parse(match[1]);
    if (!raw || typeof raw !== "object") return null;
    return {
      version: typeof raw.version === "string" ? raw.version : undefined,
      name: typeof raw.name === "string" ? raw.name : undefined,
      description: typeof raw.description === "string" ? raw.description : undefined,
      colors: coerceStringMap(raw.colors),
      typography: coerceTypography(raw.typography),
      rounded: coerceStringMap(raw.rounded),
      spacing: coerceStringMap(raw.spacing),
      components: coerceComponents(raw.components),
    };
  } catch {
    return null;
  }
}

export function buildTokenMap(enriched: EnrichedFrontmatter): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(enriched.colors)) {
    map.set(`colors.${k}`, v);
  }
  for (const [scaleName, scale] of Object.entries(enriched.typography)) {
    for (const [prop, val] of Object.entries(scale)) {
      map.set(`typography.${scaleName}.${prop}`, val);
    }
  }
  for (const [k, v] of Object.entries(enriched.rounded)) {
    map.set(`rounded.${k}`, v);
  }
  for (const [k, v] of Object.entries(enriched.spacing)) {
    map.set(`spacing.${k}`, v);
  }
  return map;
}

export function resolveTokenRefs(value: string, tokenMap: Map<string, string>): string {
  return value.replace(/\{([^}]+)\}/g, (match, ref) => tokenMap.get(ref.trim()) ?? match);
}

function coerceStringMap(val: unknown): Record<string, string> {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (typeof v === "string") result[String(k)] = v;
    else if (typeof v === "number") result[String(k)] = String(v);
  }
  return result;
}

function coerceTypography(val: unknown): Record<string, EnrichedTypographyScale> {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const result: Record<string, EnrichedTypographyScale> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = coerceStringMap(v) as EnrichedTypographyScale;
    }
  }
  return result;
}

function coerceComponents(val: unknown): Record<string, Record<string, string>> {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const result: Record<string, Record<string, string>> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = coerceStringMap(v);
    }
  }
  return result;
}
