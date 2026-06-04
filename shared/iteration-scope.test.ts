import { describe, expect, it } from "vitest";
import { validateSectionScope } from "./iteration-scope";

const PREVIOUS = `---
name: Stripe
description: "Original system."
colors:
  canvas: "#ffffff"
typography:
  body-md:
    fontSize: 16px
spacing:
  md: 16px
components:
  card:
    padding: "{spacing.md}"
---

## Overview
Original overview.

## Typography
Original type prose.

## Layout
Original layout prose.

## Components
Original component prose.
`;

describe("validateSectionScope", () => {
  it("allows scoped typography changes to typography YAML and body only", () => {
    const next = PREVIOUS.replace("fontSize: 16px", "fontSize: 18px").replace(
      "Original type prose.",
      "Updated type prose.",
    );

    expect(
      validateSectionScope(
        { previousMarkdown: PREVIOUS, sectionTarget: "typography" },
        next,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects typography scope changes to spacing tokens", () => {
    const next = PREVIOUS.replace("md: 16px", "md: 20px");

    expect(
      validateSectionScope(
        { previousMarkdown: PREVIOUS, sectionTarget: "typography" },
        next,
      ),
    ).toEqual({
      ok: false,
      reason: "section_scope_frontmatter_changed:spacing",
    });
  });

  it("rejects typography scope changes to components prose", () => {
    const next = PREVIOUS.replace(
      "Original component prose.",
      "Updated component prose.",
    );

    expect(
      validateSectionScope(
        { previousMarkdown: PREVIOUS, sectionTarget: "typography" },
        next,
      ),
    ).toEqual({
      ok: false,
      reason: "section_scope_body_changed:components",
    });
  });

  it("allows layout scope changes to spacing YAML and layout body", () => {
    const next = PREVIOUS.replace("md: 16px", "md: 20px").replace(
      "Original layout prose.",
      "Updated layout prose.",
    );

    expect(
      validateSectionScope(
        { previousMarkdown: PREVIOUS, sectionTarget: "layout" },
        next,
      ),
    ).toEqual({ ok: true });
  });

  it("allows shapes scope changes to rounded YAML", () => {
    const next = PREVIOUS.replace(
      "components:",
      "rounded:\n  button: 4px\ncomponents:",
    );

    expect(
      validateSectionScope(
        { previousMarkdown: PREVIOUS, sectionTarget: "shapes" },
        next,
      ),
    ).toEqual({ ok: true });
  });
});
