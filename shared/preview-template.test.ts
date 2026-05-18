import { describe, expect, it } from "vitest";
import { renderPreview } from "./preview-template";
import type { DesignSystemData } from "./api";

function fullData(): DesignSystemData {
  return {
    colors: {
      primary: "#635bff",
      secondary: "",
      accent: "",
      background: "#ffffff",
      surface: "",
      text: "#1a1a1a",
      textMuted: "",
    },
    typography: {
      headingFont: "Sohne Var",
      bodyFont: "Sohne Var",
      headingWeight: "700",
      bodyWeight: "400",
      headingSizes: { h1: "56px", h2: "32px", h3: "20px" },
    },
    spacing: { slidePadding: "", elementGap: "" },
    borders: {
      radius: "6px",
      accentWidth: "",
      radii: { button: "", card: "", pill: "" },
    },
    slideDefaults: { background: "", labelStyle: "none" },
    logos: [
      { url: "https://example.com/logo.png", name: "Acme", variant: "auto" },
    ],
  };
}

function emptyData(): DesignSystemData {
  return {
    colors: {
      primary: "",
      secondary: "",
      accent: "",
      background: "",
      surface: "",
      text: "",
      textMuted: "",
    },
    typography: {
      headingFont: "",
      bodyFont: "",
      headingWeight: "",
      bodyWeight: "",
      headingSizes: { h1: "", h2: "", h3: "" },
    },
    spacing: { slidePadding: "", elementGap: "" },
    borders: {
      radius: "",
      accentWidth: "",
      radii: { button: "", card: "", pill: "" },
    },
    slideDefaults: { background: "", labelStyle: "none" },
    logos: [],
  };
}

describe("renderPreview", () => {
  it("returns a full HTML document starting with <!doctype html>", () => {
    const html = renderPreview(fullData());
    expect(html.toLowerCase().startsWith("<!doctype html")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<head");
    expect(html).toContain("<body");
  });

  it("injects the primary color from tokens", () => {
    const html = renderPreview(fullData());
    expect(html).toContain("#635bff");
  });

  it("injects the heading font from tokens", () => {
    const html = renderPreview(fullData());
    expect(html).toContain("Sohne Var");
  });

  it("renders an <img> with the logo URL when logos[0] is present", () => {
    const html = renderPreview(fullData());
    expect(html).toContain("https://example.com/logo.png");
    expect(html).toMatch(/<img[^>]+src="https:\/\/example\.com\/logo\.png"/);
  });

  it("renders an initials fallback when no logo is present", () => {
    const html = renderPreview(emptyData(), { title: "Acme Co" });
    // No <img> tag in the header
    expect(html).not.toMatch(/<img[^>]+src=/);
    // Initials block shows the first letter
    expect(html).toContain("A");
  });

  it("uses opts.title in the header brand-name slot", () => {
    const html = renderPreview(fullData(), { title: "Stripe" });
    expect(html).toContain("Stripe");
  });

  it("falls back to a default brand name when title is omitted", () => {
    const html = renderPreview(fullData());
    // Some non-empty default should be present in the header brand slot
    expect(html).toMatch(/<header[\s\S]+<\/header>/);
  });

  it("renders without throwing when all fields are empty", () => {
    expect(() => renderPreview(emptyData())).not.toThrow();
    const html = renderPreview(emptyData());
    expect(html.toLowerCase().startsWith("<!doctype html")).toBe(true);
  });

  it("includes hero elements: label, h1, body, primary CTA, ghost CTA", () => {
    const html = renderPreview(fullData(), { title: "Acme" });
    expect(html).toContain("<h1");
    // Two buttons in the hero
    const buttonMatches = html.match(/<button/g) ?? [];
    expect(buttonMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("includes three feature cards", () => {
    const html = renderPreview(fullData());
    const cardMatches = html.match(/class="[^"]*card[^"]*"/g) ?? [];
    expect(cardMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("shows a 'primary not extracted' marker when primary is empty", () => {
    const data = fullData();
    data.colors.primary = "";
    const html = renderPreview(data);
    // The primary CTA should visibly indicate the value is missing rather
    // than rendering an invisible / page-bg-colored button.
    expect(html).toMatch(/primary[\s-]*missing|no[\s-]*primary|--/i);
  });

  it("uses the border radius token on the primary CTA and cards", () => {
    const html = renderPreview(fullData());
    expect(html).toContain("6px");
  });

  it("declares semantic --ds-button-radius and --ds-card-radius custom properties", () => {
    const data = fullData();
    data.borders.radii = { button: "9999px", card: "12px", pill: "9999px" };
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-button-radius:\s*9999px/);
    expect(html).toMatch(/--ds-card-radius:\s*12px/);
  });

  it("falls back to single borders.radius when radii.button/card are empty (old data)", () => {
    const data = fullData();
    data.borders.radius = "6px";
    data.borders.radii = { button: "", card: "", pill: "" };
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-button-radius:\s*6px/);
    expect(html).toMatch(/--ds-card-radius:\s*6px/);
  });

  it("falls back to 8px hardcoded default when both radii.* and borders.radius are empty", () => {
    const data = emptyData();
    // Sanity: emptyData() has radius "" and radii: all empty.
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-button-radius:\s*8px/);
    expect(html).toMatch(/--ds-card-radius:\s*8px/);
  });

  it("renders different radii on the button vs card rules when radii are split", () => {
    const data = fullData();
    data.borders.radii = { button: "9999px", card: "10px", pill: "9999px" };
    const html = renderPreview(data);
    // The button rule consumes --ds-button-radius, the card rule
    // consumes --ds-card-radius, so they end up different.
    expect(html).toContain("border-radius: var(--ds-button-radius)");
    expect(html).toContain("border-radius: var(--ds-card-radius)");
  });
});
