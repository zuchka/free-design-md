import type { DesignSystemData } from "./api";

// Optional per-element computed-style fields used to populate `components`.
// All fields stay optional so older Playwright captures (pre-C5) still parse.
export interface ButtonAnatomy {
  padding?: string;
  fontSize?: string;
  fontWeight?: string;
  borderTopWidth?: string;
  borderTopStyle?: string;
  borderTopColor?: string;
}

export interface CardAnatomy {
  padding?: string;
  backgroundColor?: string;
  color?: string;
  borderTopWidth?: string;
  borderTopStyle?: string;
  borderTopColor?: string;
  boxShadow?: string;
}

export interface LinkAnatomy {
  textDecorationLine?: string;
  fontWeight?: string;
}

export interface HeadingAnatomy {
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
}

export interface ExtractedSignals {
  url: string;
  title: string;
  description: string;
  themeColor: string;
  faviconUrl: string;
  cssVars: Record<string, string>;
  htmlBackgroundColor: string;
  body: {
    backgroundColor: string;
    color: string;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
  };
  h1:
    | ({
        fontFamily: string;
        fontSize: string;
        fontWeight: string;
        color: string;
      } & HeadingAnatomy)
    | null;
  h2: ({ fontSize: string } & HeadingAnatomy) | null;
  h3: ({ fontSize: string } & HeadingAnatomy) | null;
  link: ({ color: string } & LinkAnatomy) | null;
  button:
    | ({
        backgroundColor: string;
        borderRadius: string;
        color: string;
      } & ButtonAnatomy)
    | null;
  cta:
    | ({
        backgroundColor: string;
        color: string;
        borderRadius: string;
      } & ButtonAnatomy)
    | null;
  cardSample?: ({ borderRadius: string } & CardAnatomy) | null;
  pillRadius?: string;
  // C6: counted occurrences of padding/gap values across all elements,
  // counted in-browser to keep the Playwright-to-Node payload small.
  paddingHistogram?: Record<string, number>;
}

function normalizeColor(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  const rgbMatch = trimmed.match(
    /^rgba?\s*\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)\s*(?:[,/]?\s*(\d*\.?\d+)\s*)?\)$/,
  );
  if (rgbMatch) {
    const [, r, g, b, aRaw] = rgbMatch;
    const alpha = aRaw === undefined ? 1 : parseFloat(aRaw);
    if (alpha === 0) return "";
    if (alpha < 1) return `rgba(${r}, ${g}, ${b}, ${aRaw})`;
    const hex = (n: string) =>
      parseInt(n, 10).toString(16).padStart(2, "0").toLowerCase();
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  if (trimmed.startsWith("#")) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function extractFontFamily(input: string): string {
  if (!input) return "";
  const first = input.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "").trim();
}

// Normalize a raw font-family stack from getComputedStyle so it's safe to
// embed in our preview's <style> block and our design.md YAML. Trims, drops
// empties, leaves quoting intact. We preserve the brand's full fallback
// chain because their stack (e.g. "Mackinac, ui-serif, Georgia, ..., serif")
// is the most faithful rendering instruction we have when the primary font
// is proprietary and won't load.
function normalizeFontStack(input: string): string {
  if (!input) return "";
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.join(", ");
}

function pickCssVar(vars: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const v = vars[name];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

function extractRadius(input: string): string {
  if (!input) return "";
  const first = input.trim().split(/\s+/)[0]?.trim() ?? "";
  if (!first || first === "0" || first === "0px") return "";
  return first;
}

function parseRgbValues(input: string): [number, number, number] | null {
  if (!input) return null;
  const trimmed = input.trim();
  const rgbMatch = trimmed.match(
    /^rgba?\s*\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/,
  );
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1] ?? "0", 10),
      parseInt(rgbMatch[2] ?? "0", 10),
      parseInt(rgbMatch[3] ?? "0", 10),
    ];
  }
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  if (hexMatch) {
    const hex = hexMatch[1] ?? "000000";
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return null;
}

function chromaOf(color: string): number {
  const rgb = parseRgbValues(color);
  if (!rgb) return 0;
  return Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
}

const MIN_BRAND_CHROMA = 30;

function hasUsableOpacity(color: string): boolean {
  if (!color || !color.trim()) return false;
  const trimmed = color.trim();
  if (trimmed === "transparent") return false;

  // rgba(R, G, B, A) — legacy comma syntax
  const rgbaCommaMatch = trimmed.match(
    /^rgba?\s*\([^)]*,\s*(\d*\.?\d+)\s*\)$/,
  );
  if (rgbaCommaMatch) {
    return parseFloat(rgbaCommaMatch[1] ?? "1") >= 0.5;
  }

  // modern color syntax with `/ alpha`: oklab(L a b / A), oklch(...), lab(...), etc.
  const slashAlphaMatch = trimmed.match(/\/\s*(\d*\.?\d+%?)\s*\)$/);
  if (slashAlphaMatch) {
    const raw = slashAlphaMatch[1] ?? "1";
    const alpha = raw.endsWith("%")
      ? parseFloat(raw.slice(0, -1)) / 100
      : parseFloat(raw);
    return alpha >= 0.5;
  }

  return true;
}

// --- C5 component anatomy ---

function parsePxValue(input: string | undefined): number | null {
  if (!input) return null;
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return m && m[1] !== undefined ? parseFloat(m[1]) : null;
}

function isImplausibleButtonPadding(padding: string | undefined): boolean {
  if (!padding) return true;
  const parts = padding.trim().split(/\s+/);
  // Padding shorthand entirely zero — almost always an icon button or a
  // container we mis-classified, not a real CTA's padding.
  if (parts.every((p) => p === "0" || p === "0px")) return true;
  return false;
}

function isImplausibleButtonFontSize(size: string | undefined): boolean {
  const px = parsePxValue(size);
  if (px === null) return true;
  return px < 10 || px > 48;
}

function composeBorder(
  width: string | undefined,
  style: string | undefined,
  color: string | undefined,
): string {
  const w = parsePxValue(width);
  if (w === null || w <= 0) return "";
  if (!style || style === "none") return "";
  const normalizedColor = color ? normalizeColor(color) : "";
  return `${width} ${style} ${normalizedColor}`.replace(/\s+/g, " ").trim();
}

interface ButtonAnatomySource {
  backgroundColor: string;
  color: string;
  borderRadius: string;
  padding?: string;
  fontSize?: string;
  fontWeight?: string;
  borderTopWidth?: string;
  borderTopStyle?: string;
  borderTopColor?: string;
}

function pickButtonPrimarySource(
  signals: ExtractedSignals,
): ButtonAnatomySource | null {
  const cta = signals.cta;
  const ctaBg = cta?.backgroundColor ?? "";
  if (cta && hasUsableOpacity(ctaBg) && chromaOf(ctaBg) >= MIN_BRAND_CHROMA) {
    return cta;
  }
  const button = signals.button;
  const buttonBg = button?.backgroundColor ?? "";
  if (
    button &&
    hasUsableOpacity(buttonBg) &&
    chromaOf(buttonBg) >= MIN_BRAND_CHROMA
  ) {
    return button;
  }
  return null;
}

function synthesizeButtonPrimary(
  signals: ExtractedSignals,
): NonNullable<NonNullable<DesignSystemData["components"]>["button"]>["primary"] | null {
  const source = pickButtonPrimarySource(signals);
  if (!source) return null;
  const background = normalizeColor(source.backgroundColor);
  const color = normalizeColor(source.color);
  const radius = extractRadius(source.borderRadius);
  const padding = isImplausibleButtonPadding(source.padding)
    ? ""
    : (source.padding ?? "").trim();
  const fontSize = isImplausibleButtonFontSize(source.fontSize)
    ? ""
    : (source.fontSize ?? "").trim();
  const fontWeight = (source.fontWeight ?? "").trim();
  const border = composeBorder(
    source.borderTopWidth,
    source.borderTopStyle,
    source.borderTopColor,
  );
  return {
    background,
    color,
    radius,
    padding,
    fontSize,
    fontWeight,
    border,
  };
}

function synthesizeCard(
  signals: ExtractedSignals,
): NonNullable<DesignSystemData["components"]>["card"] | null {
  const sample = signals.cardSample;
  if (!sample) return null;
  // Padding 0px 0px is the same mis-classification signal as on buttons:
  // we picked an element that looked card-shaped but isn't actually padded
  // like a card. Drop the whole sub-tree rather than emit a flat card spec.
  if (isImplausibleButtonPadding(sample.padding)) return null;

  const radius = extractRadius(sample.borderRadius);
  const padding = (sample.padding ?? "").trim();
  const background = normalizeColor(sample.backgroundColor ?? "");
  const color = normalizeColor(sample.color ?? "");
  const border = composeBorder(
    sample.borderTopWidth,
    sample.borderTopStyle,
    sample.borderTopColor,
  );
  const rawShadow = (sample.boxShadow ?? "").trim();
  const shadow = rawShadow && rawShadow !== "none" ? rawShadow : "";

  return { background, color, radius, padding, border, shadow };
}

function synthesizeLink(
  signals: ExtractedSignals,
): NonNullable<DesignSystemData["components"]>["link"] | null {
  const link = signals.link;
  if (!link) return null;
  const color = normalizeColor(link.color);
  if (!color) return null;
  const rawDecoration = (link.textDecorationLine ?? "").trim();
  const textDecoration = rawDecoration || "";
  const fontWeight = (link.fontWeight ?? "").trim();
  return { color, textDecoration, fontWeight };
}

function synthesizeHeading(
  source: HeadingAnatomy | null | undefined,
): { lineHeight: string; letterSpacing: string; color: string } | null {
  if (!source) return null;
  const lineHeight = (source.lineHeight ?? "").trim();
  const letterSpacing = (source.letterSpacing ?? "").trim();
  const color = source.color ? normalizeColor(source.color) : "";
  if (!lineHeight && !letterSpacing && !color) return null;
  return { lineHeight, letterSpacing, color };
}

function synthesizeHeadings(
  signals: ExtractedSignals,
): NonNullable<DesignSystemData["components"]>["headings"] | null {
  const h1 = synthesizeHeading(signals.h1);
  const h2 = synthesizeHeading(signals.h2);
  const h3 = synthesizeHeading(signals.h3);
  if (!h1 && !h2 && !h3) return null;
  const out: NonNullable<
    NonNullable<DesignSystemData["components"]>["headings"]
  > = {};
  if (h1) out.h1 = h1;
  if (h2) out.h2 = h2;
  if (h3) out.h3 = h3;
  return out;
}

function synthesizeComponents(
  signals: ExtractedSignals,
): DesignSystemData["components"] | undefined {
  const buttonPrimary = synthesizeButtonPrimary(signals);
  const card = synthesizeCard(signals);
  const link = synthesizeLink(signals);
  const headings = synthesizeHeadings(signals);
  const out: NonNullable<DesignSystemData["components"]> = {};
  if (buttonPrimary) {
    out.button = { primary: buttonPrimary };
  }
  if (card) {
    out.card = card;
  }
  if (link) {
    out.link = link;
  }
  if (headings) {
    out.headings = headings;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function synthesizeDesignSystem(
  signals: ExtractedSignals,
): DesignSystemData {
  const {
    body,
    h1,
    h2,
    h3,
    button,
    cta,
    cssVars,
    themeColor,
    htmlBackgroundColor,
    faviconUrl,
    title,
    cardSample,
    pillRadius,
  } = signals;

  const primaryVar = pickCssVar(cssVars, [
    "--primary",
    "--primary-color",
    "--brand",
  ]);
  const ctaBg = cta?.backgroundColor ?? "";
  const ctaCandidate = hasUsableOpacity(ctaBg) ? ctaBg : "";
  const buttonBg = button?.backgroundColor ?? "";
  const buttonCandidate =
    hasUsableOpacity(buttonBg) && chromaOf(buttonBg) >= MIN_BRAND_CHROMA
      ? buttonBg
      : "";
  const themeCandidate =
    chromaOf(themeColor) >= MIN_BRAND_CHROMA ? themeColor : "";
  const primarySource =
    primaryVar || ctaCandidate || buttonCandidate || themeCandidate || "";
  const primary = normalizeColor(primarySource);

  let background = normalizeColor(body.backgroundColor);
  if (!background) {
    background = normalizeColor(htmlBackgroundColor);
  }
  if (!background) {
    background = normalizeColor(pickCssVar(cssVars, ["--background", "--bg"]));
  }

  let text = normalizeColor(body.color);
  if (!text) {
    text = normalizeColor(
      pickCssVar(cssVars, ["--foreground", "--text", "--color"]),
    );
  }

  const headingFont = extractFontFamily(h1?.fontFamily ?? "");
  const bodyFont = extractFontFamily(body.fontFamily);
  // Full captured font-family stack. Preserves the brand's intended fallback
  // chain (e.g. "Mackinac, ui-serif, Georgia, ..., serif" for Fly.io) so the
  // preview renders in the right generic family when the primary proprietary
  // font can't load.
  const headingFontStack = normalizeFontStack(h1?.fontFamily ?? "");
  const bodyFontStack = normalizeFontStack(body.fontFamily);
  const headingWeight = h1?.fontWeight ?? "";
  const bodyWeight = body.fontWeight;
  const h1Size = h1?.fontSize ?? "";
  const h2Size = h2?.fontSize ?? "";
  const h3Size = h3?.fontSize ?? "";

  const radiusVar = pickCssVar(cssVars, [
    "--radius",
    "--rounded-md",
    "--rounded",
  ]);
  const radius =
    radiusVar ||
    extractRadius(button?.borderRadius ?? "") ||
    extractRadius(cta?.borderRadius ?? "");

  // Semantic radii — populated independently of the single-radius fallback above.
  // Empty strings are fine; consumers fall back to the single `radius` then a
  // hardcoded default. See plan: borders.radii is the agent-readable split.
  const radiiButton =
    extractRadius(button?.borderRadius ?? "") ||
    extractRadius(cta?.borderRadius ?? "") ||
    radiusVar;
  const radiiCard = extractRadius(cardSample?.borderRadius ?? "");
  const radiiPill = pillRadius ?? "";

  const logos = faviconUrl
    ? [{ url: faviconUrl, name: title || "", variant: "auto" as const }]
    : [];

  const components = synthesizeComponents(signals);

  return {
    colors: {
      primary,
      secondary: "",
      accent: "",
      background,
      surface: "",
      text,
      textMuted: "",
    },
    typography: {
      headingFont,
      bodyFont,
      headingFontStack,
      bodyFontStack,
      headingWeight,
      bodyWeight,
      headingSizes: { h1: h1Size, h2: h2Size, h3: h3Size },
    },
    spacing: { slidePadding: "", elementGap: "" },
    borders: {
      radius,
      accentWidth: "",
      radii: {
        button: radiiButton,
        card: radiiCard,
        pill: radiiPill,
      },
    },
    slideDefaults: { background: "", labelStyle: "none" },
    logos,
    ...(components ? { components } : {}),
  };
}
