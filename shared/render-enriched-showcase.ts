import type { EnrichedFrontmatter } from "./parse-enriched-design-md";
import { buildTokenMap, resolveTokenRefs } from "./parse-enriched-design-md";
import { safe, escapeHtml, SAFE_COLOR, SAFE_SIZE } from "./preview-template";

const SAFE_WEIGHT = /^[1-9]00$|^\d{3}$/;
const SAFE_LHEIGHT = /^\d+(\.\d+)?(px|rem|em|%)?$/;

function pick(map: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = map[k];
    if (v) return v;
  }
  return "";
}

export function renderEnrichedPreview(
  enriched: EnrichedFrontmatter,
  markdownSource: string,
  title?: string,
): string {
  const tokenMap = buildTokenMap(enriched);

  const bg = safe(pick(enriched.colors, "canvas", "canvas-soft", "background"), SAFE_COLOR) || "#ffffff";
  const text = safe(pick(enriched.colors, "ink", "text"), SAFE_COLOR) || "#1a1a1a";
  const primary = safe(enriched.colors["primary"] ?? "", SAFE_COLOR) || "";
  const border = safe(pick(enriched.colors, "hairline", "border"), SAFE_COLOR) || "";
  const radius = safe(pick(enriched.rounded, "md", "sm"), SAFE_SIZE) || "8px";

  const safeTitle = escapeHtml((enriched.name ?? title ?? "Design System").trim());

  // ── Colors ──────────────────────────────────────────────────────────────────
  const colorEntries = Object.entries(enriched.colors);
  const colorSwatches = colorEntries.map(([tokenName, value]) => {
    const sv = safe(value, SAFE_COLOR);
    if (!sv) return "";
    return `<div class="eds-swatch">
      <div class="eds-swatch-chip" style="background:${sv};"></div>
      <div class="eds-swatch-name">${escapeHtml(tokenName)}</div>
      <div class="eds-swatch-value">${escapeHtml(sv)}</div>
    </div>`;
  }).filter(Boolean).join("\n");

  const colorsSection = colorSwatches
    ? `<section class="eds-section">
        <h2 class="eds-section-title">Colors <span class="eds-count">${colorEntries.length} tokens</span></h2>
        <div class="eds-swatches">${colorSwatches}</div>
      </section>`
    : "";

  // ── Typography ───────────────────────────────────────────────────────────────
  const typographyEntries = Object.entries(enriched.typography);
  const typeSamples = typographyEntries.map(([scaleName, scale]) => {
    const fontSize = safe(scale.fontSize ?? "", SAFE_SIZE);
    const fontWeight = safe(scale.fontWeight ?? "", SAFE_WEIGHT);
    const lineHeight = safe(scale.lineHeight ?? "", SAFE_LHEIGHT);
    const letterSpacing = safe(scale.letterSpacing ?? "", /^-?\d+(\.\d+)?(px|em|rem)$/);
    const fontFamily = scale.fontFamily ?? "system-ui, sans-serif";
    const displaySize = fontSize || "16px";
    const metaParts = [
      fontSize,
      fontWeight ? `weight ${fontWeight}` : "",
      lineHeight ? `lh ${lineHeight}` : "",
      letterSpacing ? `ls ${letterSpacing}` : "",
    ].filter(Boolean).join(" · ");
    return `<div class="eds-type-sample">
      <div class="eds-type-scale-name">${escapeHtml(scaleName)}</div>
      <div class="eds-type-specimen" style="font-size:${escapeHtml(displaySize)};font-weight:${escapeHtml(fontWeight || "400")};line-height:${escapeHtml(lineHeight || "1.4")};letter-spacing:${escapeHtml(letterSpacing || "0")};font-family:${escapeHtml(fontFamily)};">The quick brown fox</div>
      <div class="eds-type-meta">${escapeHtml(metaParts)}</div>
    </div>`;
  }).join("\n");

  const typographySection = typeSamples
    ? `<section class="eds-section">
        <h2 class="eds-section-title">Typography <span class="eds-count">${typographyEntries.length} scales</span></h2>
        <div class="eds-type-stack">${typeSamples}</div>
      </section>`
    : "";

  // ── Spacing ──────────────────────────────────────────────────────────────────
  const spacingEntries = Object.entries(enriched.spacing);
  const spacingItems = spacingEntries.map(([tokenName, value]) => {
    const sv = safe(value, SAFE_SIZE);
    if (!sv) return "";
    return `<div class="eds-spacing-item">
      <div class="eds-spacing-bar" style="width:${escapeHtml(sv)};height:${escapeHtml(sv)};"></div>
      <div class="eds-spacing-name">${escapeHtml(tokenName)}</div>
      <div class="eds-spacing-val">${escapeHtml(sv)}</div>
    </div>`;
  }).filter(Boolean).join("\n");

  const spacingSection = spacingItems
    ? `<section class="eds-section">
        <h2 class="eds-section-title">Spacing <span class="eds-count">${spacingEntries.length} tokens</span></h2>
        <div class="eds-spacing-track">${spacingItems}</div>
      </section>`
    : "";

  // ── Radii ────────────────────────────────────────────────────────────────────
  const radiiEntries = Object.entries(enriched.rounded);
  const radiiItems = radiiEntries.map(([tokenName, value]) => {
    const sv = value.trim();
    if (!sv) return "";
    return `<div class="eds-radius-item">
      <div class="eds-radius-chip" style="border-radius:${escapeHtml(sv)};"></div>
      <div class="eds-radius-name">${escapeHtml(tokenName)}</div>
      <div class="eds-radius-val">${escapeHtml(sv)}</div>
    </div>`;
  }).filter(Boolean).join("\n");

  const radiiSection = radiiItems
    ? `<section class="eds-section">
        <h2 class="eds-section-title">Border Radii <span class="eds-count">${radiiEntries.length} tokens</span></h2>
        <div class="eds-radii-track">${radiiItems}</div>
      </section>`
    : "";

  // ── Components ───────────────────────────────────────────────────────────────
  const componentEntries = Object.entries(enriched.components);
  const componentCards = componentEntries.map(([compName, props]) => {
    const resolved = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, resolveTokenRefs(v, tokenMap)])
    );

    const isButtonLike = !!(resolved["backgroundColor"] && resolved["color"] && resolved["padding"]);
    const livePreview = isButtonLike
      ? `<div class="eds-comp-preview">
          <button style="background:${escapeHtml(safe(resolved["backgroundColor"] ?? "", SAFE_COLOR))};color:${escapeHtml(safe(resolved["color"] ?? "", SAFE_COLOR))};padding:${escapeHtml(resolved["padding"] ?? "8px 16px")};border-radius:${escapeHtml(safe(resolved["borderRadius"] ?? resolved["rounded"] ?? "4px", /^.*$/))};border:0;font-size:${escapeHtml(safe(resolved["fontSize"] ?? "14px", SAFE_SIZE))};font-weight:${escapeHtml(safe(resolved["fontWeight"] ?? "600", SAFE_WEIGHT))};cursor:pointer;">${escapeHtml(compName)}</button>
        </div>`
      : "";

    const tokenRows = Object.entries(props).map(([prop, rawVal]) => {
      const resolvedVal = resolveTokenRefs(rawVal, tokenMap);
      const isRef = rawVal !== resolvedVal;
      return `<tr>
        <td class="eds-token-prop">${escapeHtml(prop)}</td>
        <td class="eds-token-resolved">${escapeHtml(resolvedVal)}</td>
        ${isRef ? `<td class="eds-token-ref">${escapeHtml(rawVal)}</td>` : `<td></td>`}
      </tr>`;
    }).join("\n");

    return `<div class="eds-comp-card">
      <div class="eds-comp-name">${escapeHtml(compName)}</div>
      ${livePreview}
      <table class="eds-token-table">
        <thead><tr><th>prop</th><th>resolved</th><th>token</th></tr></thead>
        <tbody>${tokenRows}</tbody>
      </table>
    </div>`;
  }).join("\n");

  const componentsSection = componentCards
    ? `<section class="eds-section">
        <h2 class="eds-section-title">Components <span class="eds-count">${componentEntries.length} defined</span></h2>
        <div class="eds-comp-grid">${componentCards}</div>
      </section>`
    : "";

  // ── design.md source ─────────────────────────────────────────────────────────
  const sourceSection = markdownSource
    ? `<section class="eds-section">
        <h2 class="eds-section-title">design.md source</h2>
        <pre class="eds-source-block"><code>${escapeHtml(markdownSource)}</code></pre>
      </section>`
    : "";

  const primaryVar = primary || "var(--eds-text)";
  const borderVar = border || "color-mix(in srgb, var(--eds-text) 12%, var(--eds-bg))";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AI-Enriched Design System — ${safeTitle}</title>
<style>
:root {
  --eds-bg: ${bg};
  --eds-text: ${text};
  --eds-primary: ${primaryVar};
  --eds-border: ${borderVar};
  --eds-muted: color-mix(in srgb, var(--eds-text) 50%, var(--eds-bg));
  --eds-radius: ${radius};
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--eds-bg); color: var(--eds-text); font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
.eds-wrap { max-width: 960px; margin: 0 auto; padding: 48px 40px 80px; }
.eds-header { margin-bottom: 48px; }
.eds-header-label { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
.eds-header-sub { font-size: 12px; color: var(--eds-muted); margin-top: 4px; }
.eds-section { margin-bottom: 56px; }
.eds-section-title { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--eds-muted); margin: 0 0 20px; display: flex; align-items: center; gap: 8px; }
.eds-count { font-size: 10px; font-weight: 500; letter-spacing: 0.5px; background: color-mix(in srgb, var(--eds-text) 8%, var(--eds-bg)); border-radius: 10px; padding: 2px 8px; }
.eds-swatches { display: flex; flex-wrap: wrap; gap: 16px; }
.eds-swatch { display: flex; flex-direction: column; gap: 5px; min-width: 70px; }
.eds-swatch-chip { width: 56px; height: 56px; border-radius: var(--eds-radius); border: 1px solid var(--eds-border); }
.eds-swatch-name { font-size: 11px; font-weight: 600; }
.eds-swatch-value { font-size: 10px; color: var(--eds-muted); font-family: monospace; }
.eds-type-stack { display: flex; flex-direction: column; gap: 24px; }
.eds-type-sample { border-bottom: 1px solid var(--eds-border); padding-bottom: 20px; }
.eds-type-sample:last-child { border-bottom: none; }
.eds-type-scale-name { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--eds-primary); margin-bottom: 6px; font-family: monospace; }
.eds-type-specimen { color: var(--eds-text); word-break: break-word; }
.eds-type-meta { font-size: 10px; color: var(--eds-muted); margin-top: 6px; font-family: monospace; }
.eds-spacing-track { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.eds-spacing-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.eds-spacing-bar { background: color-mix(in srgb, var(--eds-primary, var(--eds-text)) 55%, var(--eds-bg)); border-radius: 2px; min-width: 4px; min-height: 4px; max-width: 100px; max-height: 100px; }
.eds-spacing-name { font-size: 10px; font-weight: 600; font-family: monospace; }
.eds-spacing-val { font-size: 10px; color: var(--eds-muted); font-family: monospace; }
.eds-radii-track { display: flex; flex-wrap: wrap; gap: 16px; }
.eds-radius-item { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.eds-radius-chip { width: 56px; height: 56px; background: color-mix(in srgb, var(--eds-primary, var(--eds-text)) 20%, var(--eds-bg)); border: 1.5px solid color-mix(in srgb, var(--eds-primary, var(--eds-text)) 50%, var(--eds-bg)); }
.eds-radius-name { font-size: 10px; font-weight: 600; font-family: monospace; }
.eds-radius-val { font-size: 10px; color: var(--eds-muted); font-family: monospace; }
.eds-comp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.eds-comp-card { border: 1px solid var(--eds-border); border-radius: var(--eds-radius); padding: 16px; }
.eds-comp-name { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; font-family: monospace; color: var(--eds-primary); margin-bottom: 10px; }
.eds-comp-preview { margin-bottom: 12px; }
.eds-token-table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: monospace; }
.eds-token-table th { text-align: left; font-weight: 600; color: var(--eds-muted); border-bottom: 1px solid var(--eds-border); padding: 3px 0; }
.eds-token-table td { padding: 3px 4px 3px 0; vertical-align: top; }
.eds-token-prop { font-weight: 600; color: var(--eds-text); white-space: nowrap; }
.eds-token-resolved { color: var(--eds-text); }
.eds-token-ref { color: var(--eds-muted); }
.eds-source-block { background: color-mix(in srgb, var(--eds-text) 4%, var(--eds-bg)); border: 1px solid var(--eds-border); border-radius: var(--eds-radius); padding: 20px; overflow-x: auto; font-size: 11px; line-height: 1.7; font-family: ui-monospace, monospace; white-space: pre; max-height: 480px; overflow-y: auto; }
</style>
</head>
<body>
<div class="eds-wrap">
  <div class="eds-header">
    <div class="eds-header-label">${safeTitle} — AI-Enriched Design System</div>
    <div class="eds-header-sub">Generated by Claude Opus 4.7 · Google Stitch schema</div>
  </div>
  ${colorsSection}
  ${typographySection}
  ${spacingSection}
  ${radiiSection}
  ${componentsSection}
  ${sourceSection}
</div>
</body>
</html>`;
}
