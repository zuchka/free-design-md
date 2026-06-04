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
});
