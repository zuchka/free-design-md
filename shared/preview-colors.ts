// Preview-only color handling. Keep the extracted tokens and exported Markdown
// intact, but never place a sampled foreground on an unrelated, unreadable fill.
type Rgba = [number, number, number, number];
type Rgb = [number, number, number];
const clamp = (n: number, max = 1) => Math.max(0, Math.min(max, n));
const linearToSrgb = (v: number) =>
  255 * clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function parseColor(value: string): Rgba | null {
  const s = value.trim().toLowerCase();
  if (s === "transparent") return [0, 0, 0, 0];
  if (s === "black") return [0, 0, 0, 1];
  if (s === "white") return [255, 255, 255, 1];
  if (/^#[\da-f]{3,4}$/.test(s)) {
    return parseColor("#" + [...s.slice(1)].map((v) => v + v).join(""));
  }
  if (/^#[\da-f]{6}([\da-f]{2})?$/.test(s)) {
    return [
      parseInt(s.slice(1, 3), 16),
      parseInt(s.slice(3, 5), 16),
      parseInt(s.slice(5, 7), 16),
      s.length === 9 ? parseInt(s.slice(7), 16) / 255 : 1,
    ];
  }
  // Tailwind-style bare HSL channels are often captured from CSS variables.
  if (/^[\d.]+\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*[\d.]+%?)?$/.test(s)) {
    return parseColor(`hsl(${s})`);
  }
  const match = s.match(
    /^(rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color)\(([^)]+)\)$/,
  );
  if (!match) return null;
  const kind = match[1]!;
  let channels = match[2]!;
  if (kind === "color") {
    if (!channels.startsWith("srgb ")) return null;
    channels = channels.slice(5);
  }
  const parts = channels.trim().split(/[\s,/]+/);
  if (
    parts.length < 3 ||
    parts.length > 4 ||
    parts.some((p) => !/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?%?$/.test(p))
  )
    return null;
  const nums = parts.map(parseFloat);
  const alpha = clamp((nums[3] ?? 1) / (parts[3]?.endsWith("%") ? 100 : 1));
  let rgb: number[];
  if (kind.startsWith("rgb") || kind === "color") {
    rgb = nums
      .slice(0, 3)
      .map(
        (n, i) =>
          n * (parts[i]!.endsWith("%") ? 2.55 : kind === "color" ? 255 : 1),
      );
  } else if (kind.startsWith("hsl")) {
    const h = (((nums[0]! % 360) + 360) % 360) / 30;
    const sat = clamp(nums[1]! / 100),
      light = clamp(nums[2]! / 100);
    const a = sat * Math.min(light, 1 - light);
    rgb = [0, 8, 4].map(
      (n) =>
        255 *
        (light -
          a *
            Math.max(-1, Math.min(((n + h) % 12) - 3, 9 - ((n + h) % 12), 1))),
    );
  } else {
    let [l, a, b] = nums as [number, number, number];
    if (kind.endsWith("lch")) {
      const radians = (b * Math.PI) / 180;
      [a, b] = [a * Math.cos(radians), a * Math.sin(radians)];
    }
    if (kind.startsWith("ok")) {
      if (parts[0]!.endsWith("%")) l /= 100;
      const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
      const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
      const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
      rgb = [
        4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
        -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
        -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
      ].map(linearToSrgb);
    } else {
      const f = (v: number) =>
        v ** 3 > 216 / 24389 ? v ** 3 : (116 * v - 16) / (24389 / 27);
      const y = (l + 16) / 116;
      // Lab D50 -> XYZ D50 -> XYZ D65 -> linear sRGB.
      const x50 = 0.96422 * f(y + a / 500),
        y50 = f(y),
        z50 = 0.82521 * f(y - b / 200);
      const x = 0.9555766 * x50 - 0.0230393 * y50 + 0.0631636 * z50;
      const yy = -0.0282895 * x50 + 1.0099416 * y50 + 0.0210077 * z50;
      const z = 0.0122982 * x50 - 0.020483 * y50 + 1.3299098 * z50;
      rgb = [
        3.2404542 * x - 1.5371385 * yy - 0.4985314 * z,
        -0.969266 * x + 1.8760108 * yy + 0.041556 * z,
        0.0556434 * x - 0.2040259 * yy + 1.0572252 * z,
      ].map(linearToSrgb);
    }
  }
  return [clamp(rgb[0]!, 255), clamp(rgb[1]!, 255), clamp(rgb[2]!, 255), alpha];
}

function composite(color: Rgba, backdrop: Rgb): Rgb {
  return color
    .slice(0, 3)
    .map((n, i) => n * color[3] + backdrop[i]! * (1 - color[3])) as Rgb;
}

function luminance(rgb: Rgb): number {
  return rgb
    .map((n) => n / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
}

/** Resolve translucent/unsupported surfaces against the actual parent fill. */
export function previewSurface(value: string, backdrop = "#ffffff"): string {
  const parent = parseColor(backdrop) ?? [255, 255, 255, 1];
  const parsed = parseColor(value);
  if (!parsed) return backdrop;
  return toHex(composite(parsed, composite(parent, [255, 255, 255])));
}

function toHex(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((n) => Math.round(clamp(n, 255)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(previewSurface(background))!;
  const fg = parseColor(foreground);
  if (!fg) return 0;
  const a = luminance(composite(fg, bg.slice(0, 3) as Rgb));
  const b = luminance(bg.slice(0, 3) as Rgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Prefer observed colors; fall back only when a pair cannot be read. */
export function readableColor(
  background: string,
  ...candidates: string[]
): string {
  for (const color of candidates) {
    if (contrastRatio(color, background) >= 4.5)
      return previewSurface(color, background);
  }
  return contrastRatio("#000000", background) >
    contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";
}

export function mutedColor(
  background: string,
  text: string,
  candidate = "",
): string {
  if (candidate && contrastRatio(candidate, background) >= 4.5)
    return previewSurface(candidate, background);
  const fg = parseColor(text)!,
    bg = parseColor(previewSurface(background))!;
  // Keep a modest visual hierarchy while retaining a margin above AA contrast.
  const mixed = toHex(
    composite([fg[0], fg[1], fg[2], 0.72], bg.slice(0, 3) as Rgb),
  );
  return contrastRatio(mixed, background) >= 4.8 ? mixed : text;
}
