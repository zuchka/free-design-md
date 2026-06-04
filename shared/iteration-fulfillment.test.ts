import { describe, expect, it } from "vitest";
import {
  isDarkModeRequest,
  validateIterationFulfillment,
} from "./iteration-fulfillment";

const PREVIOUS = `---
name: Stripe
colors:
  canvas: "#ffffff"
  canvas-soft: "#f2f7fe"
  ink: "#061b31"
  hairline: "#d0d8e4"
components:
  card-feature:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
---

## Overview
Light memo.
`;

describe("isDarkModeRequest", () => {
  it("detects common dark-mode phrasing", () => {
    expect(isDarkModeRequest("Turn this into a dark mode version.")).toBe(true);
    expect(isDarkModeRequest("Make it dark but keep the brand voice.")).toBe(
      true,
    );
    expect(isDarkModeRequest("Create a night theme.")).toBe(true);
  });

  it("does not treat narrow color edits as theme conversion", () => {
    expect(isDarkModeRequest("Darken the primary violet slightly.")).toBe(
      false,
    );
    expect(isDarkModeRequest("Make the hero more dramatic.")).toBe(false);
  });
});

describe("validateIterationFulfillment", () => {
  it("rejects dark-mode requests that only add dark alternate tokens", () => {
    const next = `---
name: Stripe
colors:
  canvas: "#ffffff"
  canvas-soft: "#f2f7fe"
  ink: "#061b31"
  hairline: "#d0d8e4"
  dark-canvas: "#061b31"
  dark-ink: "#e8f0fb"
components:
  card-feature:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
  dark-card-feature:
    backgroundColor: "{colors.dark-canvas}"
    textColor: "{colors.dark-ink}"
---
`;

    expect(
      validateIterationFulfillment(
        {
          previousMarkdown: PREVIOUS,
          userPrompt: "Turn this into a dark mode version.",
        },
        next,
      ),
    ).toEqual({ ok: false, reason: "dark_mode_added_alternate_tokens_only" });
  });

  it("accepts dark-mode requests that rewrite canonical surface and text tokens", () => {
    const next = `---
name: Stripe
colors:
  canvas: "#061b31"
  canvas-soft: "#0c2340"
  ink: "#e8f0fb"
  hairline: "#1a3a5c"
components:
  card-feature:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
---
`;

    expect(
      validateIterationFulfillment(
        {
          previousMarkdown: PREVIOUS,
          userPrompt: "Turn this into a dark mode version.",
        },
        next,
      ),
    ).toEqual({ ok: true });
  });
});
