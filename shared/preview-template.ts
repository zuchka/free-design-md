import type { DesignSystemData } from "./api";

export interface RenderPreviewOptions {
  title?: string;
}

const SAFE_COLOR = /^[#a-zA-Z0-9(),./%\s.-]+$/;
const SAFE_FONT = /^[a-zA-Z0-9 _-]+$/;
// Font stacks contain comma-separated family names, quoted or bare, plus the
// CSS generic keywords. We don't allow braces, semicolons, parens, or @ to
// keep arbitrary CSS out of our <style> block.
const SAFE_STACK = /^[a-zA-Z0-9 ,'"._\-]+$/;
const SAFE_SIZE = /^\d+(\.\d+)?(px|rem|em|%)$/;
const SAFE_WEIGHT = /^[1-9]00$|^\d{3}$/;
// Padding shorthand: one to four space-separated length values.
const SAFE_PADDING = /^\d+(\.\d+)?(px|rem|em|%)(\s+\d+(\.\d+)?(px|rem|em|%)){0,3}$/;
// Border shorthand: "<width> <style> <color>" e.g. "1px solid #e5e5e5".
const SAFE_BORDER = /^\d+(\.\d+)?(px|rem|em)\s+(solid|dashed|dotted|double)\s+#[0-9a-fA-F]{3,8}$/;

function safe(value: string, pattern: RegExp): string {
  if (!value) return "";
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

export function renderPreview(
  data: DesignSystemData,
  opts: RenderPreviewOptions = {},
): string {
  const title = (opts.title ?? "Brand").trim() || "Brand";
  const safeTitle = escapeHtml(title);
  const initial = escapeHtml((title.charAt(0) || "B").toUpperCase());

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
    safe(data.components?.button?.primary?.fontWeight ?? "", SAFE_WEIGHT) || "600";
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
    <p class="lede">A synthetic landing page styled with the design system extracted from the live site. Squint — does it feel like the brand?</p>
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
</body>
</html>
`;
}
