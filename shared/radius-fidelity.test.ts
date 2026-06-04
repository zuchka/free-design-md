import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  applyDeterministicRadiusFidelity,
  deterministicButtonRadius,
} from "./radius-fidelity";
import type { DesignSystemData } from "./api";

const DATA = {
  borders: {
    radii: { button: "6px", card: "", pill: "9999px" },
  },
  components: {
    button: {
      primary: {
        radius: "4px",
      },
    },
  },
} as DesignSystemData;

describe("deterministicButtonRadius", () => {
  it("prefers the extracted component button radius over the semantic fallback", () => {
    expect(deterministicButtonRadius(DATA)).toBe("4px");
  });

  it("rejects non-CSS radius values", () => {
    expect(
      deterministicButtonRadius({
        borders: { radii: { button: "calc(1px + 1px)" } },
      }),
    ).toBeNull();
  });
});

describe("applyDeterministicRadiusFidelity", () => {
  it("locks enriched button components to the measured deterministic radius", () => {
    const markdown = `---
version: "1.0"
name: "Stripe"
description: "Payments infrastructure."
colors:
  primary: "#635bff"
typography: {}
rounded:
  md: "8px"
  pill: "9999px"
spacing:
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    color: "#ffffff"
    padding: "8px 16px"
    borderRadius: "{rounded.md}"
  feature-card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
---

## Overview

Stripe uses tight rectangular CTAs.
`;

    const result = applyDeterministicRadiusFidelity(markdown, DATA);
    const yaml = result.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const frontmatter = parse(yaml) as {
      rounded: Record<string, string>;
      components: Record<string, Record<string, string>>;
    };

    expect(frontmatter.rounded.button).toBe("4px");
    expect(frontmatter.components["button-primary"]?.borderRadius).toBe(
      "{rounded.button}",
    );
    expect(frontmatter.components["feature-card"]?.rounded).toBe(
      "{rounded.md}",
    );
    expect(result).toContain("## Overview");
    expect(result).toContain("Stripe uses tight rectangular CTAs.");
  });

  it("adds a rounded property to button-like components that omitted one", () => {
    const markdown = `---
name: "Demo"
rounded:
  md: "8px"
components:
  nav-cta-signup:
    backgroundColor: "#635bff"
    color: "#fff"
    padding: "8px 16px"
---
`;

    const result = applyDeterministicRadiusFidelity(markdown, DATA);
    const yaml = result.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const frontmatter = parse(yaml) as {
      components: Record<string, Record<string, string>>;
    };

    expect(frontmatter.components["nav-cta-signup"]?.rounded).toBe(
      "{rounded.button}",
    );
  });

  it("returns malformed markdown unchanged", () => {
    const markdown = "---\n: broken: [yaml\n---\n";
    expect(applyDeterministicRadiusFidelity(markdown, DATA)).toBe(markdown);
  });
});
