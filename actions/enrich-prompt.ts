import type Anthropic from "@anthropic-ai/sdk";
import type { DesignSystemData } from "../shared/api.js";
import type { ExtractedSignals } from "../shared/extract-design-system.js";

/**
 * Bumping this constant invalidates every cached enrichment in the
 * `enrichment_cache` table (see actions/enrich-design-md.ts). Bump
 * whenever the prompt structure changes in a way that should produce
 * different output for the same URL.
 */
export const PROMPT_VERSION = "v3";

export interface EnrichmentPromptInput {
  /** The URL the user is enriching a DESIGN.md for. */
  url: string;
  /** The deterministic DesignSystemData object produced by our extractor. */
  designSystemData: DesignSystemData;
  /** The deterministic Markdown produced by `designSystemToDesignMd`. */
  deterministicMarkdown: string;
  /** Raw signals from the Playwright pass (so the LLM sees what we saw). */
  signals: ExtractedSignals;
  /**
   * Reference DESIGN.md to use as the schema exemplar. We pass it in
   * rather than reading it from disk inside this module so the prompt
   * builder stays a pure function. The action layer reads the .md off
   * disk and threads it through.
   */
  schemaReference: string;
}

export interface EnrichmentPrompt {
  /**
   * System prompt as Anthropic content blocks. The single block has
   * `cache_control: { type: "ephemeral" }` so the entire ~40 KB
   * VoltAgent reference + stable instructions hit the prompt cache on
   * the second and subsequent calls.
   */
  systemBlocks: Anthropic.TextBlockParam[];
  /** Prose part of the user message. The action layer adds the screenshot as an image content block alongside this. */
  userText: string;
}

/**
 * Build the system + user prompt for AI enrichment of a DESIGN.md file.
 *
 * The LLM's job is to take our deterministic CSS-derived extraction
 * and synthesise a richer DESIGN.md following Google Stitch's schema
 * (as exemplified by VoltAgent's hand-curated catalogue). It MUST
 * stay grounded in the signals/screenshot we provide — no invention
 * of colours, fonts, components that aren't visibly present.
 */
export function buildEnrichmentPrompt(
  input: EnrichmentPromptInput,
): EnrichmentPrompt {
  const {
    url,
    designSystemData,
    deterministicMarkdown,
    signals,
    schemaReference,
  } = input;

  const systemPrompt = `You are a senior design-systems writer producing a DESIGN.md file for a brand. DESIGN.md is a plain-text design-system document (concept introduced by Google Stitch) that AI agents read to generate consistent UI.

Your job: given (a) a deterministic CSS-derived extraction of a real live website, (b) a full-page screenshot of that site, and (c) a reference DESIGN.md showing the target schema, produce a new DESIGN.md for the user's URL that matches the reference's schema and editorial quality.

## Schema you must produce

Match the reference's structure exactly:

1. YAML frontmatter with these top-level blocks (in this order):
   - 'version', 'name', 'description' (one paragraph of editorial brand-voice prose — see Editorial voice below)
   - 'colors' — flat key:value pairs with SEMANTIC names (e.g. 'primary', 'on-primary', 'ink', 'body', 'mute', 'hairline', 'canvas', 'canvas-soft', 'link', 'success', 'error', 'warning', plus any brand-distinctive accents and gradient stop pairs). Aim for 15–30 colour tokens.
   - 'typography' — named type-scale tokens (e.g. 'display-xl', 'display-lg', 'display-md', 'body-lg', 'body-md', 'body-sm', 'caption', 'code', 'button-md', 'button-lg'), each with 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', and 'letterSpacing' where applicable.
   - 'rounded' — named radii ('none', 'xs', 'sm', 'md', 'lg', 'xl', 'pill', 'full' etc.).
   - 'spacing' — named scale ('xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', etc.).
   - 'components' — 15+ named components (e.g. 'nav-bar', 'nav-link', 'nav-cta-signup', 'button-primary', 'button-secondary', 'card-marketing', 'pricing-card', 'pricing-card-featured', 'hero-band', 'feature-card', 'footer', 'badge', 'form-input', 'tab-pill', 'link-inline' etc.). Each component's values MUST use token references to the scales above using the curly-brace syntax: e.g. 'padding: "{spacing.lg} {spacing.xl}"', 'backgroundColor: "{colors.primary}"', 'rounded: "{rounded.md}"', 'typography: "{typography.body-md}"'.

2. After the frontmatter, prose sections (use H2 headings):
   - '## Overview' — 2–4 short paragraphs about the brand's design language.
   - '## Colors' — categorised colour bullets, each linking back to its token name.
   - '## Typography' — type-scale table (Markdown table) + a 'Principles' subsection capturing the brand's typographic voice (e.g. 'negative tracking is part of the voice', 'sentence-case headlines').
   - '## Layout' — 'Spacing System', 'Grid & Container', and 'Whitespace Philosophy' subsections.
   - '## Elevation & Depth' — table of shadow levels if the brand uses elevated cards / modals.
   - Closing 'Dos / Don'ts' lists where applicable.

## Editorial voice

- Sound like a designer describing the brand to another designer. Specific, observed, opinionated. NOT marketing copy.
- Example phrases (do not copy): "stark black-and-ink duet on near-white canvas", "negative tracking is part of the voice", "the mesh gradient is the entire decoration system", "subtle stacked-shadow elevation — never a single heavy drop-shadow".
- Each colour bullet should explain WHERE it's used, not just what hex it is.
- Each type token should explain its role (e.g. "hero headline at 48 px with -2.4 px tracking").

## Hard constraints

1. **Never invent colours.** Every hex code must come from the extracted signals or be visible in the screenshot. If you're uncertain, omit it.
2. **Never invent components.** If you can't see a 'pricing-card' in the screenshot, don't add one. Better to ship a smaller, accurate component list than a confabulated rich one.
3. **Never invent font names.** Use only the fonts present in the extracted typography signals. If the brand uses a proprietary face you can't name, write its closest open-source substitute as a 'fallback' note.
4. **Token references are mandatory in components.** Component values must reference scales by '{token}' syntax, never raw values. The scales must be defined in the frontmatter blocks above.
5. **The reference is for SCHEMA, not CONTENT.** Match the reference's SHAPE. Do not copy its colours, names, or prose — those belong to Vercel, not to the URL you're enriching.
6. **fontFamily must be a single fully-quoted string.** Write fontFamily: "Courier New, Courier, monospace" — the entire font stack inside one set of double quotes. Never write fontFamily: "Courier New", Courier, monospace — quoting only the first name breaks YAML because the parser reads "Courier New" as the complete scalar and errors on the unquoted tail.
7. **Scalar values containing ": " must be quoted.** If any value (especially the top-level description) contains a colon followed by a space, wrap the entire value in double quotes, e.g. description: "A brand: that uses colons".
8. **Measured radii are source-of-truth tokens.** When deterministic extraction or raw signals include button, card, or pill radii, preserve those exact measured radius values in the 'rounded' scale and make the matching components reference them. Do not convert a measured square/4px/6px/8px button into a pill just because the reference DESIGN.md uses pill buttons. For example, if the extracted primary button radius is 4px, 'button-primary' must resolve to 4px.

## Reference DESIGN.md (Vercel — VoltAgent, MIT)

This is the SCHEMA TARGET. Match the structure. Do NOT reuse Vercel's specifics.

\`\`\`markdown
${schemaReference}
\`\`\`

## Output

Reply with ONLY the DESIGN.md file content, starting with the '---' YAML frontmatter delimiter. No code fences, no preamble, no postamble.`;

  const designSystemJson = JSON.stringify(designSystemData, null, 2);
  const signalsSummary = summariseSignals(signals);
  const geometryLocks = summariseGeometryLocks(designSystemData);

  const userText = `Enrich the DESIGN.md for: **${url}**

## Deterministic extraction (what our CSS-only extractor produced)

\`\`\`markdown
${deterministicMarkdown}
\`\`\`

## Structured signals (raw)

\`\`\`json
${designSystemJson}
\`\`\`

## Deterministic token locks

${geometryLocks}

## Additional signals from the live page

${signalsSummary}

## Screenshot

(See the attached image of the full page.)

---

Produce a richer DESIGN.md that:
- Matches the reference's SCHEMA exactly (frontmatter blocks with named tokens + token references, then prose sections).
- Uses ONLY the colours/fonts present above or visible in the screenshot.
- Preserves objective measurements from the deterministic extraction, especially button radius, card radius, pill radius, padding, and typography sizes.
- Has a brand-specific editorial voice in the description and Overview — not generic.
- Names 15+ components based on what is actually visible in the screenshot.

Reply with the DESIGN.md file content only.`;

  return {
    systemBlocks: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    userText,
  };
}

function summariseGeometryLocks(data: DesignSystemData): string {
  const lines: string[] = [];
  const buttonRadius =
    data.components?.button?.primary?.radius?.trim() ||
    data.borders?.radii?.button?.trim() ||
    "";
  if (buttonRadius) {
    lines.push(
      `- Button/CTA radius is measured as \`${buttonRadius}\`. Define \`rounded.button: "${buttonRadius}"\` and make every button/CTA component use \`"{rounded.button}"\` for its radius/rounded property.`,
    );
  }

  const cardRadius =
    data.components?.card?.radius?.trim() || data.borders?.radii?.card?.trim();
  if (cardRadius) {
    lines.push(
      `- Card radius is measured as \`${cardRadius}\`. Keep it separate from the button radius and do not apply button geometry to cards.`,
    );
  }

  if (data.borders?.radii?.pill?.trim()) {
    lines.push(
      `- A pill radius was observed as \`${data.borders.radii.pill.trim()}\`, but this is only for explicitly pill-shaped elements. Do not use it for normal Stripe-style rectangular CTAs unless the measured button radius is also pill-sized.`,
    );
  }

  return lines.length
    ? lines.join("\n")
    : "- No locked component geometry was available from the deterministic pass.";
}

function summariseSignals(signals: ExtractedSignals): string {
  const lines: string[] = [];
  lines.push(`- Page title: ${signals.title || "(none)"}`);
  if (signals.description)
    lines.push(`- Meta description: ${signals.description}`);
  if (signals.themeColor)
    lines.push(`- meta theme-color: \`${signals.themeColor}\``);
  if (signals.body.fontFamily)
    lines.push(`- Body computed font-family: \`${signals.body.fontFamily}\``);
  if (signals.h1?.fontFamily)
    lines.push(`- H1 computed font-family: \`${signals.h1.fontFamily}\``);
  if (signals.cta) {
    lines.push(
      `- CTA element bg: \`${signals.cta.backgroundColor}\`, color: \`${signals.cta.color}\`, radius: \`${signals.cta.borderRadius}\`, padding: \`${signals.cta.padding ?? "?"}\`, fontSize: \`${signals.cta.fontSize ?? "?"}\`, fontWeight: \`${signals.cta.fontWeight ?? "?"}\``,
    );
  }
  if (signals.button) {
    lines.push(
      `- Button element bg: \`${signals.button.backgroundColor}\`, color: \`${signals.button.color}\`, radius: \`${signals.button.borderRadius}\`, padding: \`${signals.button.padding ?? "?"}\`, fontSize: \`${signals.button.fontSize ?? "?"}\``,
    );
  }
  if (signals.cardSample) {
    lines.push(
      `- Card sample bg: \`${signals.cardSample.backgroundColor ?? "?"}\`, radius: \`${signals.cardSample.borderRadius}\`, padding: \`${signals.cardSample.padding ?? "?"}\`, shadow: \`${signals.cardSample.boxShadow ?? "?"}\``,
    );
  }
  if (signals.pillRadius)
    lines.push(`- Pill radius observed on page: \`${signals.pillRadius}\``);
  if (signals.paddingHistogram) {
    const top = Object.entries(signals.paddingHistogram)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k, v]) => `${k}×${v}`)
      .join(", ");
    lines.push(`- Top padding/gap values across the page: ${top}`);
  }
  // Surface a handful of CSS variables that often encode brand tokens.
  const interestingVarPatterns = [
    /^--(primary|brand|accent|secondary|fg|foreground|bg|background|text|radius|gap|space|color-)/i,
  ];
  const cssVarsOfInterest = Object.entries(signals.cssVars ?? {})
    .filter(([k]) => interestingVarPatterns.some((p) => p.test(k)))
    .slice(0, 40);
  if (cssVarsOfInterest.length) {
    lines.push("- Brand-relevant CSS custom properties from `:root`:");
    for (const [k, v] of cssVarsOfInterest) lines.push(`  - \`${k}: ${v}\``);
  }
  return lines.join("\n");
}
