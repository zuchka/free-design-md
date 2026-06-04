import type { DesignSystemData } from "./api";

export interface RenderPreviewOptions {
  title?: string;
  designMd?: string;
}

export const SAFE_COLOR = /^[#a-zA-Z0-9(),./%\s.-]+$/;
const SAFE_FONT = /^[a-zA-Z0-9 _-]+$/;
// Font stacks contain comma-separated family names, quoted or bare, plus the
// CSS generic keywords. We don't allow braces, semicolons, parens, or @ to
// keep arbitrary CSS out of our <style> block.
const SAFE_STACK = /^[a-zA-Z0-9 ,'"._\-]+$/;
export const SAFE_SIZE = /^\d+(\.\d+)?(px|rem|em|%)$/;
const SAFE_WEIGHT = /^[1-9]00$|^\d{3}$/;
// Padding shorthand: one to four space-separated length values.
const SAFE_PADDING =
  /^\d+(\.\d+)?(px|rem|em|%)(\s+\d+(\.\d+)?(px|rem|em|%)){0,3}$/;
// Border shorthand: "<width> <style> <color>" e.g. "1px solid #e5e5e5".
const SAFE_BORDER =
  /^\d+(\.\d+)?(px|rem|em)\s+(solid|dashed|dotted|double)\s+#[0-9a-fA-F]{3,8}$/;

export function safe(value: string, pattern: RegExp): string {
  if (!value) return "";
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : "";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractDescriptionFromDesignMd(markdown: string | undefined): string {
  if (!markdown) return "";
  const match = markdown
    .trim()
    .replace(/\r\n/g, "\n")
    .match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match?.[1]) return "";
  const line = match[1]
    .split("\n")
    .find((candidate) => /^description:\s*/.test(candidate.trim()));
  if (!line) return "";
  const raw = line.replace(/^\s*description:\s*/, "").trim();
  if (!raw) return "";
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return raw;
}

const COLOR_LABELS: { key: keyof DesignSystemData["colors"]; label: string }[] =
  [
    { key: "primary", label: "Primary" },
    { key: "secondary", label: "Secondary" },
    { key: "accent", label: "Accent" },
    { key: "background", label: "Background" },
    { key: "surface", label: "Surface" },
    { key: "text", label: "Text" },
    { key: "textMuted", label: "Text Muted" },
  ];

function buildFontFamily(stack: string, primary: string): string {
  // Use the brand's full captured stack verbatim when it survives sanitization
  // — that's the highest-fidelity rendering instruction we have. Their stack
  // already starts with the primary font name and ends with a proper generic
  // family, so we don't sandwich our own opinion in the middle.
  const safeStack = safe(stack, SAFE_STACK);
  if (safeStack) return safeStack;
  // Fallback: stack didn't capture or didn't survive sanitization. Build a
  // minimal one from the primary name + sans-serif (the safest default).
  const safePrimary = safe(primary, SAFE_FONT);
  if (safePrimary) return `"${safePrimary}", system-ui, sans-serif`;
  return "system-ui, sans-serif";
}

function renderShowcase(data: DesignSystemData, designMd: string): string {
  // ── Colors ──────────────────────────────────────────────────
  const colorSwatches = COLOR_LABELS.filter(({ key }) =>
    (data.colors[key] ?? "").trim(),
  )
    .map(({ key, label }) => {
      const value = safe(data.colors[key].trim(), SAFE_COLOR);
      if (!value) return null;
      return `<div class="sc-swatch">
        <div class="sc-swatch-chip" style="background:${value}"></div>
        <div class="sc-swatch-label">${escapeHtml(label)}</div>
        <div class="sc-swatch-value">${escapeHtml(value)}</div>
      </div>`;
    })
    .filter(Boolean)
    .join("\n");

  const colorsSection = colorSwatches
    ? `<section class="sc-section">
        <h2 class="sc-section-title">Colors</h2>
        <div class="sc-swatches">${colorSwatches}</div>
      </section>`
    : "";

  // ── Typography ───────────────────────────────────────────
  const headingSamples = [
    {
      size: safe(data.typography.headingSizes.h1, SAFE_SIZE) || "56px",
      label: "Heading 1",
    },
    {
      size: safe(data.typography.headingSizes.h2, SAFE_SIZE) || "32px",
      label: "Heading 2",
    },
    {
      size: safe(data.typography.headingSizes.h3, SAFE_SIZE) || "20px",
      label: "Heading 3",
    },
  ]
    .map(
      ({ size, label }) => `
  <div class="sc-type-sample">
    <div class="sc-type-specimen" style="font-family:var(--ds-heading-font);font-weight:var(--ds-heading-weight);font-size:${size};line-height:1.1;">The quick brown fox</div>
    <div class="sc-type-meta">${escapeHtml(label)} · ${escapeHtml(size)} · weight ${escapeHtml(safe(data.typography.headingWeight, SAFE_WEIGHT) || "700")}</div>
  </div>`,
    )
    .join("\n");

  const bodyLabel = `Body / Regular · ${escapeHtml(safe(data.typography.bodyFont, SAFE_FONT) || "system-ui")} · weight ${escapeHtml(safe(data.typography.bodyWeight, SAFE_WEIGHT) || "400")}`;
  const bodySample = `
  <div class="sc-type-sample">
    <div class="sc-type-specimen" style="font-family:var(--ds-body-font);font-weight:var(--ds-body-weight);font-size:16px;line-height:1.6;">The quick brown fox jumps over the lazy dog. Bright vixens jump; dozy fowl quack. Pack my box with five dozen liquor jugs.</div>
    <div class="sc-type-meta">${bodyLabel}</div>
  </div>`;

  const typographySection = `<section class="sc-section">
  <h2 class="sc-section-title">Typography</h2>
  <div class="sc-type-stack">
    ${headingSamples}
    ${bodySample}
  </div>
</section>`;

  // ── Spacing scale ────────────────────────────────────────
  const scale = data.spacing?.scale ?? [];
  const spacingSection = scale.length
    ? `<style>
.sc-spacing-track { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.sc-spacing-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.sc-spacing-bar {
  background: color-mix(in srgb, var(--ds-primary, var(--ds-text)) 60%, var(--ds-bg));
  border-radius: 2px;
  min-width: 4px; min-height: 4px;
  max-width: 120px; max-height: 120px;
}
.sc-spacing-val { font-size: 11px; color: var(--ds-muted); font-family: monospace; }
</style>
<section class="sc-section">
      <h2 class="sc-section-title">Spacing Scale</h2>
      <div class="sc-spacing-track">
        ${scale
          .map((v) => {
            const sv = safe(v, SAFE_SIZE);
            if (!sv) return "";
            return `<div class="sc-spacing-item">
            <div class="sc-spacing-bar" style="width:${escapeHtml(sv)};height:${escapeHtml(sv)};"></div>
            <div class="sc-spacing-val">${escapeHtml(sv)}</div>
          </div>`;
          })
          .join("\n")}
      </div>
    </section>`
    : "";

  // ── Border radii ─────────────────────────────────────────
  const radiiItems: { label: string; value: string }[] = [
    { label: "Default", value: safe(data.borders.radius, SAFE_SIZE) },
    {
      label: "Button",
      value: safe(data.borders.radii?.button ?? "", SAFE_SIZE),
    },
    { label: "Card", value: safe(data.borders.radii?.card ?? "", SAFE_SIZE) },
    { label: "Pill", value: safe(data.borders.radii?.pill ?? "", SAFE_SIZE) },
  ].filter(({ value }) => value);

  const radiiSection = radiiItems.length
    ? `<style>
.sc-radius-chip {
  width: 64px; height: 64px;
  background: color-mix(in srgb, var(--ds-primary, var(--ds-text)) 25%, var(--ds-bg));
  border: 1.5px solid color-mix(in srgb, var(--ds-primary, var(--ds-text)) 65%, var(--ds-bg));
}
</style>
<section class="sc-section">
      <h2 class="sc-section-title">Border Radii</h2>
      <div class="sc-swatches">
        ${radiiItems
          .map(
            ({ label, value }) => `
          <div class="sc-swatch">
            <div class="sc-radius-chip" style="border-radius:${escapeHtml(value)};"></div>
            <div class="sc-swatch-label">${escapeHtml(label)}</div>
            <div class="sc-swatch-value">${escapeHtml(value)}</div>
          </div>`,
          )
          .join("\n")}
      </div>
    </section>`
    : "";

  // ── Component anatomy ────────────────────────────────────
  const comps = data.components;
  let componentSection = "";
  if (comps) {
    const bp = comps.button?.primary;
    const card = comps.card;
    const link = comps.link;
    const hasButton = !!(bp && (bp.background || bp.color || bp.radius));
    const hasCard = !!(
      card &&
      (card.background || card.border || card.padding)
    );
    const hasLink = !!(link && link.color);

    if (hasButton || hasCard || hasLink) {
      const btnBg =
        safe(bp?.background ?? "", SAFE_COLOR) || "var(--ds-primary)";
      const btnColor = safe(bp?.color ?? "", SAFE_COLOR) || "var(--ds-bg)";
      const btnRadius =
        safe(bp?.radius ?? "", SAFE_SIZE) || "var(--ds-button-radius)";
      const btnPad = safe(bp?.padding ?? "", SAFE_PADDING) || "12px 22px";
      const btnFs = safe(bp?.fontSize ?? "", SAFE_SIZE) || "15px";
      const btnFw = safe(bp?.fontWeight ?? "", SAFE_WEIGHT) || "600";

      const cardBgC =
        safe(card?.background ?? "", SAFE_COLOR) || "var(--ds-bg)";
      const cardBorderC =
        safe(card?.border ?? "", SAFE_BORDER) || "1px solid var(--ds-border)";
      const cardRadiusC =
        safe(card?.radius ?? "", SAFE_SIZE) || "var(--ds-card-radius)";
      const cardPadC = safe(card?.padding ?? "", SAFE_PADDING) || "24px";

      const linkColorC =
        safe(link?.color ?? "", SAFE_COLOR) || "var(--ds-primary)";
      const linkDeco =
        (link?.textDecoration ?? "").trim() === "underline"
          ? "underline"
          : "none";

      componentSection = `<section class="sc-section sc-component-section">
      <h2 class="sc-section-title">Components</h2>
      <div class="sc-comp-grid">
        ${
          hasButton
            ? `<div class="sc-comp-item">
          <button style="background:${btnBg};color:${btnColor};border-radius:${btnRadius};padding:${btnPad};font-size:${btnFs};font-weight:${btnFw};border:0;font-family:var(--ds-body-font);cursor:pointer;">Get started</button>
          <div class="sc-comp-label">Primary Button</div>
        </div>`
            : ""
        }
        ${
          hasButton
            ? `<div class="sc-comp-item">
          <button style="background:transparent;color:var(--ds-text);border-radius:${btnRadius};padding:${btnPad};font-size:${btnFs};font-weight:${btnFw};border:1px solid var(--ds-border);font-family:var(--ds-body-font);cursor:pointer;">Learn more</button>
          <div class="sc-comp-label">Ghost Button</div>
        </div>`
            : ""
        }
        ${
          hasCard
            ? `<div class="sc-comp-item">
          <div style="background:${cardBgC};border:${cardBorderC};border-radius:${cardRadiusC};padding:${cardPadC};max-width:220px;">
            <div style="font-family:var(--ds-heading-font);font-weight:var(--ds-heading-weight);font-size:var(--ds-h3-size);margin:0 0 8px 0;">Card Title</div>
            <div style="font-size:14px;color:var(--ds-muted);">Sample card body text extracted from the site.</div>
          </div>
          <div class="sc-comp-label">Card</div>
        </div>`
            : ""
        }
        ${
          hasLink
            ? `<div class="sc-comp-item">
          <a style="color:${linkColorC};text-decoration:${linkDeco};font-family:var(--ds-body-font);">Example link text</a>
          <div class="sc-comp-label">Link</div>
        </div>`
            : ""
        }
      </div>
    </section>`;
    }
  }

  // ── design.md source ──────────────────────────────────────
  const sourceSection = designMd
    ? `<style>
.sc-source-block {
  background: color-mix(in srgb, var(--ds-text) 4%, var(--ds-bg));
  border: 1px solid var(--ds-border);
  border-radius: 8px;
  padding: 24px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.7;
  font-family: "Fira Code", "Cascadia Code", ui-monospace, monospace;
  color: var(--ds-text);
  white-space: pre;
  max-height: 480px;
  overflow-y: auto;
}
</style>
<section class="sc-section">
  <h2 class="sc-section-title">design.md source</h2>
  <pre class="sc-source-block"><code>${escapeHtml(designMd)}</code></pre>
</section>`
    : "";

  return `
<div class="ds-showcase">
  <div class="sc-header">
    <span class="sc-header-label">Design System Tokens</span>
    <span class="sc-header-sub">Extracted deterministically — no LLM</span>
  </div>
  ${colorsSection}
  ${typographySection}
  ${spacingSection}
  ${radiiSection}
  ${componentSection}
  ${sourceSection}
</div>`;
}

export function renderPreview(
  data: DesignSystemData,
  opts: RenderPreviewOptions = {},
): string {
  const title = (opts.title ?? "Brand").trim() || "Brand";
  const safeTitle = escapeHtml(title);
  const initial = escapeHtml((title.charAt(0) || "B").toUpperCase());
  const maybeLegacyData = data as unknown as { description?: unknown };
  const legacyDescription =
    typeof maybeLegacyData.description === "string"
      ? maybeLegacyData.description
      : "";
  const lede = escapeHtml(
    extractDescriptionFromDesignMd(opts.designMd).trim() ||
      legacyDescription.trim() ||
      "A synthetic landing page styled with the design system extracted from the live site. Squint — does it feel like the brand?",
  );

  const primary = safe(data.colors.primary, SAFE_COLOR);
  const bg = safe(data.colors.background, SAFE_COLOR) || "#ffffff";
  const text = safe(data.colors.text, SAFE_COLOR) || "#1a1a1a";
  const headingFont = safe(data.typography.headingFont, SAFE_FONT);
  const bodyFont = safe(data.typography.bodyFont, SAFE_FONT);
  const headingStack = data.typography.headingFontStack ?? "";
  const bodyStack = data.typography.bodyFontStack ?? "";
  const headingWeight =
    safe(data.typography.headingWeight, SAFE_WEIGHT) || "700";
  const bodyWeight = safe(data.typography.bodyWeight, SAFE_WEIGHT) || "400";
  const h1Size = safe(data.typography.headingSizes.h1, SAFE_SIZE) || "56px";
  const h2Size = safe(data.typography.headingSizes.h2, SAFE_SIZE) || "32px";
  const h3Size = safe(data.typography.headingSizes.h3, SAFE_SIZE) || "20px";
  const radius = safe(data.borders.radius, SAFE_SIZE) || "8px";
  // A value is "pill-like" if applying it to a card-shaped element would
  // produce a literal pill or ellipse: any percentage (50% on a non-square
  // element = ellipse) or a px value large enough to fully round any card
  // (>= 64px). Buttons can use pill radii intentionally; cards cannot.
  const isPillLike = (value: string): boolean => {
    if (!value) return false;
    if (value.includes("%")) return true;
    const px = value.match(/^(\d+(?:\.\d+)?)px$/);
    if (px && px[1] !== undefined && parseFloat(px[1]) >= 64) return true;
    return false;
  };
  // Semantic radii. Buttons accept pill values directly (50% on a button is
  // an intentional pill). Cards refuse to inherit a pill-like value from the
  // legacy `radius` field — if the brand uses pills on buttons but we don't
  // have a card-specific extraction, fall through to "8px" so cards don't
  // render as ovals.
  const buttonRadius = safe(data.borders.radii.button, SAFE_SIZE) || radius;
  const cardFallback = isPillLike(radius) ? "8px" : radius;
  const cardRadius = safe(data.borders.radii.card, SAFE_SIZE) || cardFallback;

  // C5 component anatomy — empty when the brand didn't supply this signal or
  // the value didn't pass sanitization. Each preview consumer keeps its
  // pre-C5 hardcoded fallback for that path.
  const buttonPadding =
    safe(data.components?.button?.primary?.padding ?? "", SAFE_PADDING) ||
    "12px 22px";
  const buttonFontSize =
    safe(data.components?.button?.primary?.fontSize ?? "", SAFE_SIZE) || "15px";
  const buttonFontWeight =
    safe(data.components?.button?.primary?.fontWeight ?? "", SAFE_WEIGHT) ||
    "600";
  const buttonBorder = safe(
    data.components?.button?.primary?.border ?? "",
    SAFE_BORDER,
  );

  const cardPadding =
    safe(data.components?.card?.padding ?? "", SAFE_PADDING) || "24px";
  const cardBgRaw = safe(data.components?.card?.background ?? "", SAFE_COLOR);
  const cardBg = cardBgRaw || "transparent";
  const cardBorder =
    safe(data.components?.card?.border ?? "", SAFE_BORDER) ||
    "1px solid var(--ds-border)";

  const linkUnderline =
    (data.components?.link?.textDecoration ?? "").trim() === "underline";

  const primaryCssVar = primary || "transparent";
  const primaryButtonClass = primary ? "primary" : "primary missing";

  const firstLogo = data.logos[0];
  const logoUrl = firstLogo?.url ?? "";
  const safeLogoUrl =
    logoUrl && /^https?:\/\/[^\s"<>]+$/.test(logoUrl) ? logoUrl : "";

  const brandMark = safeLogoUrl
    ? `<img class="brand-mark" src="${escapeHtml(safeLogoUrl)}" alt="${safeTitle} logo">`
    : `<div class="brand-initials">${initial}</div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Preview — ${safeTitle}</title>
<style>
:root {
  --ds-primary: ${primaryCssVar};
  --ds-bg: ${bg};
  --ds-text: ${text};
  --ds-heading-font: ${buildFontFamily(headingStack, headingFont)};
  --ds-body-font: ${buildFontFamily(bodyStack, bodyFont)};
  --ds-heading-weight: ${headingWeight};
  --ds-body-weight: ${bodyWeight};
  --ds-h1-size: ${h1Size};
  --ds-h2-size: ${h2Size};
  --ds-h3-size: ${h3Size};
  --ds-radius: ${radius};
  --ds-button-radius: ${buttonRadius};
  --ds-card-radius: ${cardRadius};
  --ds-button-padding: ${buttonPadding};
  --ds-button-font-size: ${buttonFontSize};
  --ds-button-font-weight: ${buttonFontWeight};
  --ds-card-padding: ${cardPadding};
  --ds-card-bg: ${cardBg};
  --ds-border: color-mix(in srgb, var(--ds-text) 12%, var(--ds-bg));
  --ds-muted: color-mix(in srgb, var(--ds-text) 55%, var(--ds-bg));
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--ds-bg);
  color: var(--ds-text);
  font-family: var(--ds-body-font);
  font-weight: var(--ds-body-weight);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 40px;
  border-bottom: 1px solid var(--ds-border);
}
.brand { display: flex; align-items: center; gap: 12px; }
.brand-mark { width: 32px; height: 32px; object-fit: contain; border-radius: 6px; }
.brand-initials {
  width: 32px; height: 32px; border-radius: 6px;
  background: ${primary || "var(--ds-text)"}; color: var(--ds-bg);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px; font-family: var(--ds-heading-font);
}
.brand-name {
  font-family: var(--ds-heading-font);
  font-weight: var(--ds-heading-weight);
  font-size: 18px;
  letter-spacing: -0.2px;
}
.nav-links {
  display: flex; gap: 24px;
  color: var(--ds-muted);
  font-size: 14px;
}
.hero {
  padding: 96px 40px 48px;
  max-width: 960px;
  margin: 0 auto;
}
.label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: ${primary || "var(--ds-muted)"};
  margin-bottom: 20px;
}
h1 {
  font-family: var(--ds-heading-font);
  font-weight: var(--ds-heading-weight);
  font-size: var(--ds-h1-size);
  line-height: 1.08;
  letter-spacing: -1.5px;
  margin: 0 0 24px 0;
  text-wrap: balance;
}
.lede {
  font-size: 18px;
  color: var(--ds-muted);
  margin: 0 0 40px 0;
  max-width: 640px;
  text-wrap: pretty;
}
.ctas { display: flex; gap: 12px; }
button {
  font-family: var(--ds-body-font);
  font-weight: var(--ds-button-font-weight);
  font-size: var(--ds-button-font-size);
  padding: var(--ds-button-padding);
  border: ${buttonBorder || "0"};
  border-radius: var(--ds-button-radius);
  cursor: pointer;
}
button.primary {
  background: var(--ds-primary);
  color: var(--ds-bg);
}
button.primary.missing {
  background: repeating-linear-gradient(45deg, #d4d4d4 0 8px, #e8e8e8 8px 16px);
  color: #6b6b6b;
  position: relative;
}
button.primary.missing::after {
  content: " (primary missing)";
  font-size: 11px;
  font-weight: 500;
  opacity: 0.7;
}
button.ghost {
  background: transparent;
  color: var(--ds-text);
  border: 1px solid var(--ds-border);
}
.cards {
  padding: 24px 40px 64px;
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  padding: var(--ds-card-padding);
  border-radius: var(--ds-card-radius);
  border: ${cardBorder};
  ${cardBgRaw ? "background: var(--ds-card-bg);" : ""}
}
${linkUnderline ? "a { text-decoration: underline; }" : ""}
.card h3 {
  font-family: var(--ds-heading-font);
  font-weight: var(--ds-heading-weight);
  font-size: var(--ds-h3-size);
  margin: 0 0 12px 0;
  letter-spacing: -0.3px;
}
.card p {
  font-size: 14px;
  color: var(--ds-muted);
  margin: 0;
  line-height: 1.5;
}
footer {
  padding: 20px 40px;
  font-size: 13px;
  color: var(--ds-muted);
  border-top: 1px solid var(--ds-border);
}
/* ── Design System Showcase ─────────────────────────── */
.ds-showcase {
  border-top: 2px solid var(--ds-border);
  padding: 64px 40px;
  max-width: 960px;
  margin: 0 auto;
}
.sc-header {
  display: flex; align-items: baseline; gap: 16px;
  margin-bottom: 48px;
}
.sc-header-label {
  font-family: var(--ds-heading-font);
  font-weight: var(--ds-heading-weight);
  font-size: 28px;
  letter-spacing: -0.5px;
}
.sc-header-sub {
  font-size: 13px;
  color: var(--ds-muted);
}
.sc-section { margin-bottom: 56px; }
.sc-section-title {
  font-family: var(--ds-heading-font);
  font-weight: var(--ds-heading-weight);
  font-size: 13px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--ds-muted);
  margin: 0 0 20px 0;
}
.sc-swatches {
  display: flex; flex-wrap: wrap; gap: 16px;
}
.sc-swatch {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  min-width: 80px;
}
.sc-swatch-chip {
  width: 64px; height: 64px;
  border-radius: var(--ds-radius);
  border: 1px solid var(--ds-border);
}
.sc-swatch-label { font-size: 12px; font-weight: 600; }
.sc-swatch-value { font-size: 11px; color: var(--ds-muted); font-family: monospace; }
.sc-type-stack { display: flex; flex-direction: column; gap: 32px; }
.sc-type-sample { border-bottom: 1px solid var(--ds-border); padding-bottom: 24px; }
.sc-type-sample:last-child { border-bottom: none; }
.sc-type-specimen { color: var(--ds-text); word-break: break-word; }
.sc-type-meta { font-size: 11px; color: var(--ds-muted); margin-top: 8px; font-family: monospace; }
.sc-comp-grid { display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start; }
.sc-comp-item { display: flex; flex-direction: column; gap: 10px; }
.sc-comp-label { font-size: 11px; color: var(--ds-muted); font-family: monospace; }
</style>
</head>
<body>
<header class="nav">
  <div class="brand">
    ${brandMark}
    <div class="brand-name">${safeTitle}</div>
  </div>
  <nav class="nav-links">
    <span>Product</span>
    <span>Pricing</span>
    <span>Docs</span>
    <span>Log in</span>
  </nav>
</header>
<main>
  <section class="hero">
    <div class="label">Built with extracted tokens</div>
    <h1>This is what ${safeTitle} could look like.</h1>
    <p class="lede">${lede}</p>
    <div class="ctas">
      <button class="${primaryButtonClass}">Get started</button>
      <button class="ghost">Read docs</button>
    </div>
  </section>
  <section class="cards">
    <div class="card">
      <h3>Fast</h3>
      <p>Extraction runs in under 10 seconds with no LLM in the loop.</p>
    </div>
    <div class="card">
      <h3>Deterministic</h3>
      <p>The same URL always produces the same design.md. No hallucinations.</p>
    </div>
    <div class="card">
      <h3>Honest</h3>
      <p>Empty fields stay empty. We don't fabricate brand colors we can't see.</p>
    </div>
  </section>
</main>
<footer>Preview generated by free-design-md from extracted design tokens.</footer>
${renderShowcase(data, opts.designMd ?? "")}
</body>
</html>
`;
}
