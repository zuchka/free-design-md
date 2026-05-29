import { describe, expect, it } from "vitest";
import {
  parseEnrichedFrontmatter,
  buildTokenMap,
  resolveTokenRefs,
  extractSectionList,
} from "./parse-enriched-design-md";

const SAMPLE_ENRICHED_MD = `---
version: "1.0"
name: "Acme Corp"
description: "Clean modern SaaS brand."
colors:
  primary: "#635BFF"
  on-primary: "#FFFFFF"
  ink: "#0A2540"
  body: "#425466"
  canvas: "#FFFFFF"
  hairline: "#E0E0E0"
typography:
  display-xl:
    fontFamily: "Sohne, system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: "700"
    lineHeight: "1.05"
    letterSpacing: "-2.5px"
  body-md:
    fontFamily: "Sohne, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "1.6"
rounded:
  sm: "6px"
  md: "8px"
  pill: "9999px"
spacing:
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    color: "{colors.on-primary}"
    padding: "{spacing.sm} {spacing.xl}"
    borderRadius: "{rounded.md}"
    fontSize: "{typography.body-md.fontSize}"
    fontWeight: "700"
  nav-bar:
    backgroundColor: "{colors.canvas}"
    borderBottom: "1px solid {colors.hairline}"
---

## Overview

Acme Corp uses a clean, modern design language.
`;

describe("parseEnrichedFrontmatter", () => {
  it("parses name and description", () => {
    const result = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD);
    expect(result?.name).toBe("Acme Corp");
    expect(result?.description).toBe("Clean modern SaaS brand.");
  });

  it("parses all color tokens", () => {
    const result = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD);
    expect(result?.colors["primary"]).toBe("#635BFF");
    expect(result?.colors["on-primary"]).toBe("#FFFFFF");
    expect(result?.colors["ink"]).toBe("#0A2540");
    expect(Object.keys(result?.colors ?? {}).length).toBe(6);
  });

  it("parses typography scales with nested properties", () => {
    const result = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD);
    expect(result?.typography["display-xl"]?.fontSize).toBe("72px");
    expect(result?.typography["display-xl"]?.fontWeight).toBe("700");
    expect(result?.typography["body-md"]?.lineHeight).toBe("1.6");
  });

  it("parses rounded tokens", () => {
    const result = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD);
    expect(result?.rounded["md"]).toBe("8px");
    expect(result?.rounded["pill"]).toBe("9999px");
  });

  it("parses spacing tokens", () => {
    const result = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD);
    expect(result?.spacing["lg"]).toBe("24px");
  });

  it("parses component definitions", () => {
    const result = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD);
    expect(result?.components["button-primary"]?.backgroundColor).toBe("{colors.primary}");
    expect(result?.components["button-primary"]?.fontWeight).toBe("700");
  });

  it("returns null for markdown with no frontmatter", () => {
    expect(parseEnrichedFrontmatter("## Just prose")).toBeNull();
  });

  it("returns null for broken YAML", () => {
    expect(parseEnrichedFrontmatter("---\n: broken: [yaml\n---")).toBeNull();
  });

  it("parses frontmatter wrapped in a markdown code fence", () => {
    const fenced = "```markdown\n" + SAMPLE_ENRICHED_MD.trim() + "\n```";
    const result = parseEnrichedFrontmatter(fenced);
    expect(result?.name).toBe("Acme Corp");
    expect(result?.colors["primary"]).toBe("#635BFF");
  });

  it("parses frontmatter with a preamble line before the --- delimiter", () => {
    const withPreamble = "Here is your DESIGN.md:\n" + SAMPLE_ENRICHED_MD;
    const result = parseEnrichedFrontmatter(withPreamble);
    expect(result?.name).toBe("Acme Corp");
    expect(result?.colors["primary"]).toBe("#635BFF");
  });

  it("parses fontFamily with an unquoted comma-separated fallback stack", () => {
    // LLMs emit  fontFamily: "Courier New", Courier, monospace  (first entry quoted,
    // rest unquoted) — the yaml library reads "Courier New" as the complete scalar
    // and throws on the tail.  The parser must pre-process this before calling yaml.parse.
    const md = `---
version: alpha
name: DING
description: Test
colors:
  canvas: "#0e0e0e"
typography:
  display-xl:
    fontFamily: "Courier New", Courier, monospace
    fontSize: 57.6px
    fontWeight: 700
    lineHeight: 63.36px
    letterSpacing: -1px
rounded:
  sm: 6px
spacing:
  xl: 20px
components: {}
---

## Body
`;
    const result = parseEnrichedFrontmatter(md);
    expect(result).not.toBeNull();
    expect(result?.typography["display-xl"]?.fontFamily).toBe('"Courier New", Courier, monospace');
    expect(result?.typography["display-xl"]?.fontSize).toBe("57.6px");
  });

  it("does not double-quote a fontFamily already fully wrapped in double quotes", () => {
    const md = `---
version: alpha
name: Test
description: Test
colors:
  canvas: "#fff"
typography:
  body-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
rounded:
  sm: 6px
spacing:
  md: 16px
components: {}
---
`;
    const result = parseEnrichedFrontmatter(md);
    expect(result).not.toBeNull();
    expect(result?.typography["body-md"]?.fontFamily).toBe("Inter, system-ui, sans-serif");
  });
});

describe("buildTokenMap", () => {
  it("builds flat token map with dot-path keys", () => {
    const parsed = parseEnrichedFrontmatter(SAMPLE_ENRICHED_MD)!;
    const map = buildTokenMap(parsed);
    expect(map.get("colors.primary")).toBe("#635BFF");
    expect(map.get("colors.on-primary")).toBe("#FFFFFF");
    expect(map.get("typography.display-xl.fontSize")).toBe("72px");
    expect(map.get("rounded.md")).toBe("8px");
    expect(map.get("spacing.xl")).toBe("32px");
  });
});

describe("resolveTokenRefs", () => {
  it("resolves a single token reference", () => {
    const map = new Map([["colors.primary", "#635BFF"]]);
    expect(resolveTokenRefs("{colors.primary}", map)).toBe("#635BFF");
  });

  it("resolves multiple references in a padding shorthand", () => {
    const map = new Map([["spacing.sm", "12px"], ["spacing.xl", "32px"]]);
    expect(resolveTokenRefs("{spacing.sm} {spacing.xl}", map)).toBe("12px 32px");
  });

  it("leaves unknown refs unchanged", () => {
    const map = new Map<string, string>();
    expect(resolveTokenRefs("{colors.unknown}", map)).toBe("{colors.unknown}");
  });

  it("resolves mixed token + literal", () => {
    const map = new Map([["colors.hairline", "#E0E0E0"]]);
    expect(resolveTokenRefs("1px solid {colors.hairline}", map)).toBe("1px solid #E0E0E0");
  });
});

describe("extractSectionList", () => {
  it("returns slugged H2 headings in order", () => {
    const md = [
      "---",
      "name: Demo",
      "---",
      "",
      "## Colors",
      "...",
      "## Typography",
      "...",
      "## Component Library",
      "...",
    ].join("\n");
    expect(extractSectionList(md)).toEqual(["colors", "typography", "component-library"]);
  });

  it("returns [] for memos with no H2", () => {
    expect(extractSectionList("---\nname: X\n---\n\nNo sections here.")).toEqual([]);
  });

  it("ignores H3 and lower", () => {
    expect(extractSectionList("## A\n### B\n## C")).toEqual(["a", "c"]);
  });

  it("dedupes adjacent dashes and trims to 40 chars", () => {
    const long = "## " + "A".repeat(60);
    const [slug] = extractSectionList(long);
    expect(slug?.length).toBeLessThanOrEqual(40);
  });
});
