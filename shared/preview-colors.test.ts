import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  mutedColor,
  previewSurface,
  readableColor,
} from "./preview-colors";

describe("preview color contrast", () => {
  it("measures WCAG contrast including translucent text and surfaces", () => {
    expect(contrastRatio("#fff", "#000")).toBe(21);
    expect(contrastRatio("#000", "#000")).toBe(1);
    expect(contrastRatio("#777", "#fff")).toBeCloseTo(4.478, 2);
    expect(contrastRatio("rgba(0, 0, 0, 0.5)", "#fff")).toBeCloseTo(3.977, 2);
    expect(previewSurface("#ffffff80", "#000000")).toBe("#808080");
    expect(previewSurface("transparent", "#123456")).toBe("#123456");
  });

  it("handles captured CSS color formats without treating white Lab as black", () => {
    expect(previewSurface("lab(100 0 0)")).toBe("#ffffff");
    expect(previewSurface("lab(0 0 0)")).toBe("#000000");
    expect(previewSurface("oklab(1 0 0)")).toBe("#ffffff");
    expect(previewSurface("oklch(0 0 0)")).toBe("#000000");
    expect(previewSurface("color(srgb 1 0 0)")).toBe("#ff0000");
    expect(previewSurface("0 0% 4%")).toBe("#0a0a0a");
    expect(previewSurface("hsl(120 100% 50%)")).toBe("#00ff00");
    expect(previewSurface("rgb(100% 0% 0% / 50%)")).toBe("#ff8080");
  });

  it("preserves readable brand colors and fixes mismatched light/dark pairs", () => {
    expect(readableColor("#ffffff", "#533afd")).toBe("#533afd");
    expect(readableColor("#000000", "#181818")).toBe("#ffffff");
    expect(readableColor("#fde050", "#ffffff", "#1c1c1e")).toBe("#1c1c1e");
    expect(
      contrastRatio(mutedColor("#ffffff", "#333840", "#aaaaaa"), "#ffffff"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(mutedColor("#08090a", "#f7f8f8"), "#08090a"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects unsafe or unsupported CSS rather than emitting it", () => {
    expect(previewSurface("red; background: url(https://example.com)")).toBe(
      "#ffffff",
    );
    expect(readableColor("#ffffff", "var(--unknown)")).toBe("#000000");
    expect(previewSurface("rgb(NaN 0 0)")).toBe("#ffffff");
  });
});
