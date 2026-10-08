import { describe, expect, it } from "vitest";
import { EXAMPLE_DESIGNS } from "../app/lib/example-library";
import { parseEnrichedFrontmatter } from "./parse-enriched-design-md";
import { renderEnrichedPreview } from "./render-enriched-showcase";
import { renderPreview } from "./preview-template";
import { contrastRatio } from "./preview-colors";

describe("curated preview readability", () => {
  for (const example of EXAMPLE_DESIGNS) {
    it(`${example.title}: uses readable foreground/background pairs in both modes`, () => {
      const original = JSON.stringify(example);
      const previews = [
        {
          prefix: "ds",
          html: renderPreview(example.data, {
            title: example.title,
            designMd: example.markdown,
          }),
          pairs: [
            ["text", "bg"],
            ["muted", "bg"],
            ["label", "bg"],
            ["button-text", "button-bg"],
            ["card-text", "card-bg"],
            ["card-muted", "card-bg"],
          ],
        },
        {
          prefix: "eds",
          html: renderEnrichedPreview(
            parseEnrichedFrontmatter(example.enrichedMarkdown)!,
            example.enrichedMarkdown,
            example.title,
            { logoUrl: example.logoPath },
          ),
          pairs: [
            ["text", "bg"],
            ["muted", "bg"],
            ["label", "bg"],
            ["on-primary", "primary"],
          ],
        },
      ];
      for (const { prefix, html, pairs } of previews) {
        const color = (name: string) =>
          html.match(
            new RegExp(`--${prefix}-${name}: (#[a-f0-9]{6});`, "i"),
          )?.[1] ?? "";
        for (const [fg, bg] of pairs) {
          expect(
            contrastRatio(color(fg!), color(bg!)),
            `${prefix}: ${fg} on ${bg}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        expect(html).toContain(
          `alt="${example.title.replace(/&/g, "&amp;")} logo"`,
        );
      }
      expect(JSON.stringify(example)).toBe(original);
    });
  }
});
