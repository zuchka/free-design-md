import { describe, expect, it } from "vitest";
import {
  synthesizeDesignSystem,
  type ExtractedSignals,
} from "./extract-design-system";

function emptySignals(): ExtractedSignals {
  return {
    url: "https://example.com",
    title: "",
    description: "",
    themeColor: "",
    faviconUrl: "",
    cssVars: {},
    htmlBackgroundColor: "",
    body: {
      backgroundColor: "",
      color: "",
      fontFamily: "",
      fontSize: "",
      fontWeight: "",
    },
    h1: null,
    h2: null,
    h3: null,
    link: null,
    button: null,
    cta: null,
  };
}

describe("synthesizeDesignSystem", () => {
  it("returns a valid DesignSystemData with empty fields when signals are empty", () => {
    const d = synthesizeDesignSystem(emptySignals());
    expect(d.colors.primary).toBe("");
    expect(d.colors.secondary).toBe("");
    expect(d.colors.accent).toBe("");
    expect(d.colors.background).toBe("");
    expect(d.colors.surface).toBe("");
    expect(d.colors.text).toBe("");
    expect(d.colors.textMuted).toBe("");
    expect(d.typography.headingFont).toBe("");
    expect(d.typography.bodyFont).toBe("");
    expect(d.typography.headingWeight).toBe("");
    expect(d.typography.bodyWeight).toBe("");
    expect(d.typography.headingSizes).toEqual({ h1: "", h2: "", h3: "" });
    expect(d.spacing).toEqual({ slidePadding: "", elementGap: "" });
    expect(d.borders).toEqual({
      radius: "",
      accentWidth: "",
      radii: { button: "", card: "", pill: "" },
    });
    expect(d.logos).toEqual([]);
  });

  it("maps body computed style to background, text, body font, and body weight", () => {
    const s = emptySignals();
    s.body = {
      backgroundColor: "rgb(255, 255, 255)",
      color: "rgb(20, 20, 20)",
      fontFamily: '"Inter", "Helvetica Neue", system-ui',
      fontSize: "16px",
      fontWeight: "400",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#ffffff");
    expect(d.colors.text).toBe("#141414");
    expect(d.typography.bodyFont).toBe("Inter");
    expect(d.typography.bodyWeight).toBe("400");
  });

  it("maps h1 computed style to heading font/weight/h1 size", () => {
    const s = emptySignals();
    s.h1 = {
      fontFamily: '"Poppins", sans-serif',
      fontSize: "56px",
      fontWeight: "900",
      color: "rgb(0, 0, 0)",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.typography.headingFont).toBe("Poppins");
    expect(d.typography.headingWeight).toBe("900");
    expect(d.typography.headingSizes.h1).toBe("56px");
  });

  it("maps h2 and h3 sizes when present", () => {
    const s = emptySignals();
    s.h2 = { fontSize: "32px" };
    s.h3 = { fontSize: "24px" };
    const d = synthesizeDesignSystem(s);
    expect(d.typography.headingSizes.h2).toBe("32px");
    expect(d.typography.headingSizes.h3).toBe("24px");
  });

  it("strips quotes and fallbacks from font-family strings", () => {
    const s = emptySignals();
    s.body.fontFamily =
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
    const d = synthesizeDesignSystem(s);
    expect(d.typography.bodyFont).toBe("SF Pro Display");
  });

  it("uses --primary CSS var over button background for primary color", () => {
    const s = emptySignals();
    s.cssVars = { "--primary": "#3b82f6" };
    s.button = {
      backgroundColor: "rgb(0, 255, 0)",
      borderRadius: "",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#3b82f6");
  });

  it("falls back to button background when no --primary CSS var", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(59, 130, 246)",
      borderRadius: "",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#3b82f6");
  });

  it("falls back to theme-color when no CSS var or button background", () => {
    const s = emptySignals();
    s.themeColor = "#FF5500";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#ff5500");
  });

  it("rejects a grayscale theme-color (e.g. site-bg-matching)", () => {
    const s = emptySignals();
    s.themeColor = "#fafafa";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("");
  });

  it("normalizes rgb to lowercase hex", () => {
    const s = emptySignals();
    s.body.backgroundColor = "rgb(255, 0, 0)";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#ff0000");
  });

  it("preserves rgba colors when alpha is below 1", () => {
    const s = emptySignals();
    s.body.color = "rgba(0, 0, 0, 0.55)";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.text).toBe("rgba(0, 0, 0, 0.55)");
  });

  it("collapses rgba with alpha 1 to hex", () => {
    const s = emptySignals();
    s.body.backgroundColor = "rgba(20, 20, 20, 1)";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#141414");
  });

  it("recognizes alternate primary CSS var names (--primary-color, --brand)", () => {
    const s1 = emptySignals();
    s1.cssVars = { "--primary-color": "#abcdef" };
    expect(synthesizeDesignSystem(s1).colors.primary).toBe("#abcdef");

    const s2 = emptySignals();
    s2.cssVars = { "--brand": "#123456" };
    expect(synthesizeDesignSystem(s2).colors.primary).toBe("#123456");
  });

  it("reads --background and --foreground CSS vars when body computed style is missing", () => {
    const s = emptySignals();
    s.cssVars = { "--background": "#0a0a0a", "--foreground": "#fafafa" };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#0a0a0a");
    expect(d.colors.text).toBe("#fafafa");
  });

  it("extracts border radius from button when present", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "",
      borderRadius: "8px",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radius).toBe("8px");
  });

  it("uses --radius CSS var over button border-radius", () => {
    const s = emptySignals();
    s.cssVars = { "--radius": "0.5rem" };
    s.button = {
      backgroundColor: "",
      borderRadius: "8px",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radius).toBe("0.5rem");
  });

  it("takes only the first value of a multi-value border-radius", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "",
      borderRadius: "8px 8px 0px 0px",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radius).toBe("8px");
  });

  it("populates logos[0] when faviconUrl is present", () => {
    const s = emptySignals();
    s.faviconUrl = "https://example.com/favicon.ico";
    s.title = "Example";
    const d = synthesizeDesignSystem(s);
    expect(d.logos).toEqual([
      { url: "https://example.com/favicon.ico", name: "Example", variant: "auto" },
    ]);
  });

  it("leaves logos empty when no faviconUrl", () => {
    const d = synthesizeDesignSystem(emptySignals());
    expect(d.logos).toEqual([]);
  });

  it("ignores zero border-radius from a button (likely a square button)", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(0, 0, 0)",
      borderRadius: "0px",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radius).toBe("");
  });

  it("ignores transparent or fully-transparent body backgrounds", () => {
    const s = emptySignals();
    s.body.backgroundColor = "rgba(0, 0, 0, 0)";
    s.cssVars = { "--background": "#ffffff" };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#ffffff");
  });

  it("does not invent secondary, accent, surface, or textMuted in C1", () => {
    const s = emptySignals();
    s.body = {
      backgroundColor: "rgb(255, 255, 255)",
      color: "rgb(0, 0, 0)",
      fontFamily: "Inter",
      fontSize: "16px",
      fontWeight: "400",
    };
    s.themeColor = "#3b82f6";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.secondary).toBe("");
    expect(d.colors.accent).toBe("");
    expect(d.colors.surface).toBe("");
    expect(d.colors.textMuted).toBe("");
  });

  // --- C1b improvements ---

  it("ignores a near-transparent button background when picking primary", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgba(0, 0, 0, 0.05)",
      borderRadius: "8px",
      color: "",
    };
    s.themeColor = "#3b82f6";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#3b82f6");
  });

  it("ignores oklab/oklch button backgrounds with low alpha", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "oklab(0.13 -0.004 -0.028 / 0.05)",
      borderRadius: "",
      color: "",
    };
    s.themeColor = "#ff5500";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#ff5500");
  });

  it("accepts a fully-opaque rgba button background as primary", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgba(59, 130, 246, 1)",
      borderRadius: "",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#3b82f6");
  });

  it("falls back to html background when body background is transparent", () => {
    const s = emptySignals();
    s.body.backgroundColor = "rgba(0, 0, 0, 0)";
    s.htmlBackgroundColor = "rgb(250, 250, 250)";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#fafafa");
  });

  it("body bg still wins over html bg when body is opaque", () => {
    const s = emptySignals();
    s.body.backgroundColor = "rgb(20, 20, 20)";
    s.htmlBackgroundColor = "rgb(255, 255, 255)";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#141414");
  });

  it("html bg still falls through to --background var when also transparent", () => {
    const s = emptySignals();
    s.body.backgroundColor = "rgba(0, 0, 0, 0)";
    s.htmlBackgroundColor = "rgba(0, 0, 0, 0)";
    s.cssVars = { "--background": "#0a0a0a" };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.background).toBe("#0a0a0a");
  });

  it("uses CTA <a> background as primary when present and opaque", () => {
    const s = emptySignals();
    s.cta = {
      backgroundColor: "rgb(99, 91, 255)",
      color: "rgb(255, 255, 255)",
      borderRadius: "8px",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#635bff");
  });

  it("prefers CTA <a> background over a plain <button> background", () => {
    const s = emptySignals();
    s.cta = {
      backgroundColor: "rgb(99, 91, 255)",
      color: "rgb(255, 255, 255)",
      borderRadius: "8px",
    };
    s.button = {
      backgroundColor: "rgb(239, 239, 239)",
      borderRadius: "4px",
      color: "rgb(0, 0, 0)",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#635bff");
  });

  it("--primary CSS var still trumps both CTA and button", () => {
    const s = emptySignals();
    s.cssVars = { "--primary": "#aa0000" };
    s.cta = {
      backgroundColor: "rgb(99, 91, 255)",
      color: "",
      borderRadius: "",
    };
    s.button = {
      backgroundColor: "rgb(0, 255, 0)",
      borderRadius: "",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#aa0000");
  });

  it("falls through to button when CTA is near-transparent", () => {
    const s = emptySignals();
    s.cta = {
      backgroundColor: "rgba(0, 0, 0, 0.05)",
      color: "",
      borderRadius: "",
    };
    s.button = {
      backgroundColor: "rgb(99, 91, 255)",
      borderRadius: "",
      color: "",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#635bff");
  });

  it("uses CTA border-radius when button has none", () => {
    const s = emptySignals();
    s.cta = {
      backgroundColor: "rgb(99, 91, 255)",
      color: "",
      borderRadius: "12px",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radius).toBe("12px");
  });

  it("rejects a grayscale button as primary candidate", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(239, 239, 239)",
      borderRadius: "4px",
      color: "rgb(0, 0, 0)",
    };
    s.themeColor = "#ff5500";
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#ff5500");
  });

  it("still uses border-radius from a rejected (grayscale) button", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(23, 23, 23)",
      borderRadius: "6px",
      color: "rgb(255, 255, 255)",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("");
    expect(d.borders.radius).toBe("6px");
  });

  it("accepts a chromatic button as primary even without a CTA link", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(31, 111, 235)",
      borderRadius: "6px",
      color: "rgb(255, 255, 255)",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.colors.primary).toBe("#1f6feb");
  });

  it("populates borders.radii.button from the button sample", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(31, 111, 235)",
      borderRadius: "9999px",
      color: "rgb(255, 255, 255)",
    };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radii.button).toBe("9999px");
  });

  it("populates borders.radii.card from cardSample.borderRadius", () => {
    const s = emptySignals();
    s.cardSample = { borderRadius: "12px" };
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radii.card).toBe("12px");
  });

  it("populates borders.radii.pill from signals.pillRadius", () => {
    const s = emptySignals();
    s.pillRadius = "9999px";
    const d = synthesizeDesignSystem(s);
    expect(d.borders.radii.pill).toBe("9999px");
  });

  it("leaves borders.radii fields empty when the new signals are missing, and does not regress the old borders.radius computation", () => {
    const s = emptySignals();
    s.button = {
      backgroundColor: "rgb(31, 111, 235)",
      borderRadius: "6px",
      color: "rgb(255, 255, 255)",
    };
    const d = synthesizeDesignSystem(s);
    // The button-derived single-radius path still works.
    expect(d.borders.radius).toBe("6px");
    // radii.button mirrors the same path (button sample -> cta -> css var).
    expect(d.borders.radii.button).toBe("6px");
    // No card or pill signals provided -> empty strings (honest).
    expect(d.borders.radii.card).toBe("");
    expect(d.borders.radii.pill).toBe("");
  });
});
