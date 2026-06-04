import { describe, expect, it } from "vitest";
import { parseEnrichedFrontmatter } from "./parse-enriched-design-md";
import { renderEnrichedPreview } from "./render-enriched-showcase";

describe("renderEnrichedPreview", () => {
  it("prefers the explicit button radius token over pill radius", () => {
    const parsed = parseEnrichedFrontmatter(`---
name: "Stripe"
colors:
  primary: "#533afd"
  on-primary: "#ffffff"
  ink: "#000000"
  canvas: "#ffffff"
typography:
  display-xl:
    fontFamily: "sohne-var, sans-serif"
    fontSize: "48px"
    fontWeight: "300"
  body-md:
    fontFamily: "sohne-var, sans-serif"
    fontSize: "16px"
    fontWeight: "400"
rounded:
  button: "4px"
  pill: "9999px"
  md: "8px"
spacing:
  md: "16px"
components: {}
---
`)!;

    const html = renderEnrichedPreview(parsed, "");
    expect(html).toContain("--eds-button-radius: 4px;");
    expect(html).toContain("--eds-card-radius: 8px;");
  });
});
