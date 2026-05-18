import type { DesignSystemData } from "./api";

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
  h1: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    color: string;
  } | null;
  h2: { fontSize: string } | null;
  h3: { fontSize: string } | null;
  link: { color: string } | null;
  button: {
    backgroundColor: string;
    borderRadius: string;
    color: string;
  } | null;
  cta: {
    backgroundColor: string;
    color: string;
    borderRadius: string;
  } | null;
  cardSample?: { borderRadius: string } | null;
  pillRadius?: string;
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
  };
}
