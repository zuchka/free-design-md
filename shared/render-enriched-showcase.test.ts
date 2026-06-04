import { describe, expect, it } from "vitest";
import type { EnrichedFrontmatter } from "./parse-enriched-design-md";
import { renderEnrichedPreview } from "./render-enriched-showcase";

function enrichedData(description?: string): EnrichedFrontmatter {
  return {
    version: "alpha",
    name: "Stripe",
    description,
    colors: {
      primary: "#533afd",
      ink: "#061b31",
      canvas: "#ffffff",
      hairline: "#d0d8e4",
    },
    typography: {
      "display-xl": {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "48px",
        fontWeight: "300",
        lineHeight: "56px",
      },
      "body-md": {
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "16px",
        fontWeight: "400",
        lineHeight: "24px",
      },
    },
    rounded: { md: "6px" },
    spacing: { md: "16px" },
    components: {},
  };
}

describe("renderEnrichedPreview", () => {
  it("uses frontmatter description as the landing page lede", () => {
    const html = renderEnrichedPreview(
      enrichedData("AI-enriched brand voice summary."),
      "---\nname: Stripe\n---\n",
      "Stripe",
    );
    expect(html).toContain(
      '<p class="lp-lede">AI-enriched brand voice summary.</p>',
    );
    expect(html).not.toContain(
      "A synthetic landing page styled with the AI-enriched design system.",
    );
  });

  it("escapes frontmatter description HTML in the landing page lede", () => {
    const html = renderEnrichedPreview(
      enrichedData("<img src=x onerror=alert(1)>"),
      "---\nname: Stripe\n---\n",
      "Stripe",
    );
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("prefers the explicit button radius token over pill radius", () => {
    const data = enrichedData();
    data.rounded = { button: "4px", pill: "9999px", md: "8px" };

    const html = renderEnrichedPreview(data, "");
    expect(html).toContain("--eds-button-radius: 4px;");
    expect(html).toContain("--eds-card-radius: 8px;");
  });

  it("uses fixed app chrome radius for the source block, not enriched brand radius", () => {
    const data = enrichedData();
    data.rounded = { md: "9999px" };

    const html = renderEnrichedPreview(data, "---\nname: Walmart\n---\n");
    expect(html).toContain(
      ".eds-source-block { background: color-mix(in srgb, var(--eds-text) 4%, var(--eds-bg)); border: 1px solid var(--eds-border); border-radius: 8px;",
    );
    expect(html).not.toMatch(
      /\.eds-source-block\s*\{[\s\S]*?border-radius:\s*var\(--eds-radius\)/,
    );
  });
});
