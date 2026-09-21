import { describe, expect, it } from "vitest";
import type { DesignSystemData } from "../shared/api";
import type { ExtractedSignals } from "../shared/extract-design-system";
import { buildEnrichmentPrompt, PROMPT_VERSION } from "./enrich-prompt";

describe("buildEnrichmentPrompt", () => {
  it("uses the compact v4 rubric without embedding a reference artifact", () => {
    const prompt = buildEnrichmentPrompt({
      url: "https://example.com/",
      designSystemData: {
        colors: { primary: "#000000" },
      } as unknown as DesignSystemData,
      deterministicMarkdown: "---\nname: Example\n---\n",
      signals: {
        url: "https://example.com/",
        title: "Example",
        description: "Example page",
        body: {},
        cssVars: {},
      } as unknown as ExtractedSignals,
    });

    const system = prompt.systemBlocks
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");

    expect(PROMPT_VERSION).toBe("v4");
    expect(system).toContain("Target 1,200–2,000 words");
    expect(system).toContain("8–12 high-value components");
    expect(system).not.toContain("Reference DESIGN.md");
    expect(system.length).toBeLessThan(10_000);
  });
});
