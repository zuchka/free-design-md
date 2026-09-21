import type Anthropic from "@anthropic-ai/sdk";
import type { DesignSystemData } from "../shared/api.js";
import type { ExtractedSignals } from "../shared/extract-design-system.js";

/**
 * Bumping this constant invalidates every cached enrichment in the
 * `enrichment_cache` table (see actions/enrich-design-md.ts). Bump
 * whenever the prompt structure changes in a way that should produce
 * different output for the same URL.
 */
export const PROMPT_VERSION = "v4";

export interface EnrichmentPromptInput {
  /** The URL the user is enriching a DESIGN.md for. */
  url: string;
  /** The deterministic DesignSystemData object produced by our extractor. */
  designSystemData: DesignSystemData;
  /** The deterministic Markdown produced by `designSystemToDesignMd`. */
  deterministicMarkdown: string;
  /** Raw signals from the Playwright pass (so the LLM sees what we saw). */
  signals: ExtractedSignals;
}

export interface EnrichmentPrompt {
  /**
   * System prompt as Anthropic content blocks. The stable rubric uses
   * `cache_control: { type: "ephemeral" }` so bursts of enrichments can
   * still benefit from prompt caching.
   */
  systemBlocks: Anthropic.TextBlockParam[];
  /** Prose part of the user message. The action layer adds the screenshot as an image content block alongside this. */
  userText: string;
}

/**
 * Build the system + user prompt for AI enrichment of a DESIGN.md file.
 *
 * The LLM's job is to take our deterministic CSS-derived extraction
 * and synthesise a concise, richer DESIGN.md following the Google Stitch
 * schema. It MUST stay grounded in the signals/screenshot we provide — no
 * invention of colours, fonts, components that aren't visibly present.
 */
export function buildEnrichmentPrompt(
  input: EnrichmentPromptInput,
): EnrichmentPrompt {
  const { url, designSystemData, deterministicMarkdown, signals } = input;

  const systemPrompt = `You are a senior design-systems writer producing a concise DESIGN.md file for a brand. DESIGN.md is a plain-text design-system document that humans and AI agents use to recreate a site's visual language consistently.

Your job: given a deterministic CSS-derived extraction and a screenshot of a real website, produce an accurate, useful DESIGN.md for the user's URL.

## Schema you must produce

Start with YAML frontmatter delimited by '---'. Use these top-level keys in order:

1. 'version', 'name', and a one-paragraph 'description'.
2. 'colors': 10–18 semantically named tokens grounded in observed values.
3. 'typography': 7–10 named roles with fontFamily, fontSize, fontWeight, lineHeight, and letterSpacing when observed.
4. 'rounded': only distinct radii the site actually uses.
5. 'spacing': a compact named scale based on observed spacing.
6. 'components': 8–12 high-value components visible on the page. Component values must reference the scales above using strings such as "{colors.primary}", "{spacing.lg}", and "{rounded.md}" instead of repeating raw values.

After the frontmatter, use these H2 sections:
- '## Overview': 1–2 short paragraphs identifying the strongest visual rules.
- '## Colors': grouped bullets explaining where the important tokens appear.
- '## Typography': a compact type-scale table followed by 2–4 brand-specific principles.
- '## Layout': concise notes on spacing, container/grid, and whitespace.
- '## Components': short implementation notes for the most important components. Do not repeat every YAML property.
- '## Elevation & Depth' only when the page visibly uses shadows, overlays, or elevation.
- '## Do's and Don'ts': 4–6 concrete bullets per list.

Target 1,200–2,000 words. Every paragraph must add implementation guidance; do not restate the YAML line by line. Prefer a smaller accurate system over an exhaustive speculative one.

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
5. **fontFamily must be a single fully-quoted string.** Write fontFamily: "Courier New, Courier, monospace" — the entire font stack inside one set of double quotes.
6. **Scalar values containing ": " must be quoted.** If any value contains a colon followed by a space, wrap the entire value in double quotes.
7. **Measured radii are source-of-truth tokens.** Preserve exact measured button, card, and pill radii. Never turn a measured square or lightly rounded CTA into a pill.
8. **Be concise.** Do not add speculative ecommerce, dashboard, authentication, or modal components just to make the document look comprehensive.

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
- Uses the required schema (frontmatter blocks with named tokens and token references, followed by concise implementation guidance).
- Uses ONLY the colours/fonts present above or visible in the screenshot.
- Preserves objective measurements from the deterministic extraction, especially button radius, card radius, pill radius, padding, and typography sizes.
- Has a brand-specific editorial voice in the description and Overview — not generic.
- Names 8–12 useful components based on what is actually visible in the screenshot.
- Stays within 1,200–2,000 words and avoids repeating the same observation in multiple sections.

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
    .slice(0, 20);
  if (cssVarsOfInterest.length) {
    lines.push("- Brand-relevant CSS custom properties from `:root`:");
    for (const [k, v] of cssVarsOfInterest) lines.push(`  - \`${k}: ${v}\``);
  }
  return lines.join("\n");
}
