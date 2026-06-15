import { describe, expect, it } from "vitest";
import {
  EXAMPLE_DESIGNS,
  getExampleDesignBySlug,
  getHomepageExamples,
} from "./example-library";
import { parseEnrichedFrontmatter } from "../../shared/parse-enriched-design-md";

describe("example-library", () => {
  it("ships eight curated examples", () => {
    expect(EXAMPLE_DESIGNS).toHaveLength(8);
    expect(getHomepageExamples()).toHaveLength(5);
  });

  it("uses unique slugs and valid public source URLs", () => {
    const slugs = new Set(EXAMPLE_DESIGNS.map((example) => example.slug));
    expect(slugs.size).toBe(EXAMPLE_DESIGNS.length);

    for (const example of EXAMPLE_DESIGNS) {
      const url = new URL(example.sourceUrl);
      expect(url.protocol).toBe("https:");
      expect(example.domain).toBe(url.hostname.replace(/^www\./, ""));
    }
  });

  it("generates non-empty markdown and token data for each example", () => {
    for (const example of EXAMPLE_DESIGNS) {
      expect(example.markdown).toContain("## Colors");
      expect(example.markdown.length).toBeGreaterThan(150);
      expect(example.logoPath).toMatch(
        new RegExp(`^/assets/examples/logos/${example.slug}\\.(svg|png)$`),
      );
      expect(example.data.logos[0]).toMatchObject({
        url: example.logoPath,
        name: example.title,
        variant: "auto",
      });
      expect(Object.values(example.data.colors).some((value) => value))
        .toBe(true);
      expect(
        [
          example.data.typography.headingFont,
          example.data.typography.bodyFont,
          example.data.typography.headingFontStack,
          example.data.typography.bodyFontStack,
        ].some((value) => value.trim().length > 0),
      ).toBe(true);
    }
  });

  it("ships production-action AI-enriched markdown for each example", () => {
    for (const example of EXAMPLE_DESIGNS) {
      const parsed = parseEnrichedFrontmatter(example.enrichedMarkdown);

      expect(example.enrichedMarkdown).toContain("## Overview");
      expect(example.enrichedMarkdown).toContain("## Do's and Don'ts");
      expect(example.enrichedMarkdown.length).toBeGreaterThan(5000);
      expect(parsed?.name).toBeTruthy();
      expect(Object.keys(parsed?.colors ?? {}).length).toBeGreaterThan(0);
      expect(Object.keys(parsed?.typography ?? {}).length).toBeGreaterThan(0);
    }
  });

  it("resolves examples by slug", () => {
    expect(getExampleDesignBySlug("stripe")?.title).toBe("Stripe");
    expect(getExampleDesignBySlug("missing")).toBeNull();
    expect(getExampleDesignBySlug(undefined)).toBeNull();
  });
});
