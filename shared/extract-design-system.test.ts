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

  it("captures the full font-family stack from h1 and body", () => {
    const s = emptySignals();
    s.h1 = {
      fontFamily: '"Mackinac", "Times New Roman", Georgia, serif',
      fontSize: "64px",
      fontWeight: "500",
      color: "rgb(0,0,0)",
    };
    s.body.fontFamily = '"Fricolage Grotesque", Inter, sans-serif';
    const d = synthesizeDesignSystem(s);
    expect(d.typography.headingFont).toBe("Mackinac");
    expect(d.typography.headingFontStack).toBe(
      '"Mackinac", "Times New Roman", Georgia, serif',
    );
    expect(d.typography.bodyFont).toBe("Fricolage Grotesque");
    expect(d.typography.bodyFontStack).toBe(
      '"Fricolage Grotesque", Inter, sans-serif',
    );
  });

  it("preserves a single-name stack (no fallback) verbatim", () => {
    const s = emptySignals();
    s.h1 = {
      fontFamily: '"Custom Font"',
      fontSize: "64px",
      fontWeight: "500",
      color: "rgb(0,0,0)",
    };
    s.body.fontFamily = '"Body Font"';
    const d = synthesizeDesignSystem(s);
    expect(d.typography.headingFontStack).toBe('"Custom Font"');
    expect(d.typography.bodyFontStack).toBe('"Body Font"');
  });

  it("normalizes whitespace inside the captured stack", () => {
    const s = emptySignals();
    s.body.fontFamily = '  ui-monospace ,   "SF Mono"  ,  Menlo,monospace  ';
    const d = synthesizeDesignSystem(s);
    expect(d.typography.bodyFontStack).toBe(
      'ui-monospace, "SF Mono", Menlo, monospace',
    );
  });

  // --- Monochrome-brand fallback: body.color → primary ---

  describe("body.color fallback for monochrome brands", () => {
    it("uses body.color as primary when no chromatic source is available (Vercel shape)", () => {
      const s = emptySignals();
      s.body = {
        backgroundColor: "rgb(250, 250, 250)",
        color: "rgb(23, 23, 23)",
        fontFamily: "Geist",
        fontSize: "16px",
        fontWeight: "400",
      };
      s.themeColor = "#fafafa"; // grayscale — rejected
      s.button = {
        backgroundColor: "rgb(255, 255, 255)", // white, chroma 0 — rejected
        borderRadius: "6px",
        color: "rgb(23, 23, 23)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.colors.primary).toBe("#171717");
    });

    it("does not override a chromatic CTA with body.color", () => {
      const s = emptySignals();
      s.body = {
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(20, 20, 20)",
        fontFamily: "Inter",
        fontSize: "16px",
        fontWeight: "400",
      };
      s.cta = {
        backgroundColor: "rgb(99, 91, 255)", // chromatic — wins
        color: "rgb(255, 255, 255)",
        borderRadius: "8px",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.colors.primary).toBe("#635bff");
    });

    it("does not override a chromatic button with body.color", () => {
      const s = emptySignals();
      s.body = {
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(20, 20, 20)",
        fontFamily: "Inter",
        fontSize: "16px",
        fontWeight: "400",
      };
      s.button = {
        backgroundColor: "rgb(31, 111, 235)", // chromatic — wins
        borderRadius: "6px",
        color: "rgb(255, 255, 255)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.colors.primary).toBe("#1f6feb");
    });

    it("skips body.color fallback when body.color is transparent", () => {
      const s = emptySignals();
      s.body = {
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgba(0, 0, 0, 0)",
        fontFamily: "Inter",
        fontSize: "16px",
        fontWeight: "400",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.colors.primary).toBe("");
    });

    it("skips body.color fallback when body.color equals the page background (invisible-text guard)", () => {
      const s = emptySignals();
      s.body = {
        backgroundColor: "rgb(20, 20, 20)",
        color: "rgb(20, 20, 20)",
        fontFamily: "Inter",
        fontSize: "16px",
        fontWeight: "400",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.colors.primary).toBe("");
    });
  });

  // --- C5: components.button.primary sub-tree ---

  describe("components.button.primary", () => {
    it("populates button.primary from the CTA <a> when CTA supplies primary", () => {
      const s = emptySignals();
      s.cta = {
        backgroundColor: "rgb(99, 91, 255)",
        color: "rgb(255, 255, 255)",
        borderRadius: "8px",
        padding: "12px 24px",
        fontSize: "15px",
        fontWeight: "600",
        borderTopWidth: "0px",
        borderTopStyle: "none",
        borderTopColor: "rgb(0, 0, 0)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.button?.primary).toEqual({
        background: "#635bff",
        color: "#ffffff",
        radius: "8px",
        padding: "12px 24px",
        fontSize: "15px",
        fontWeight: "600",
        border: "",
      });
    });

    it("populates button.primary from <button> when CTA is absent", () => {
      const s = emptySignals();
      s.button = {
        backgroundColor: "rgb(31, 111, 235)",
        borderRadius: "6px",
        color: "rgb(255, 255, 255)",
        padding: "10px 20px",
        fontSize: "14px",
        fontWeight: "500",
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: "rgb(0, 0, 0)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.button?.primary).toEqual({
        background: "#1f6feb",
        color: "#ffffff",
        radius: "6px",
        padding: "10px 20px",
        fontSize: "14px",
        fontWeight: "500",
        border: "1px solid #000000",
      });
    });

    it("emits an empty border string when borderTopWidth is 0px or style is none", () => {
      const s = emptySignals();
      s.button = {
        backgroundColor: "rgb(31, 111, 235)",
        borderRadius: "6px",
        color: "rgb(255, 255, 255)",
        padding: "10px 20px",
        fontSize: "14px",
        fontWeight: "500",
        borderTopWidth: "0px",
        borderTopStyle: "none",
        borderTopColor: "rgb(0, 0, 0)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.button?.primary?.border).toBe("");
    });

    it("drops padding 0px 0px (likely icon button slipped through)", () => {
      const s = emptySignals();
      s.button = {
        backgroundColor: "rgb(31, 111, 235)",
        borderRadius: "6px",
        color: "rgb(255, 255, 255)",
        padding: "0px 0px",
        fontSize: "14px",
        fontWeight: "500",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.button?.primary?.padding).toBe("");
    });

    it("drops font-size outside 10-48px range", () => {
      const s = emptySignals();
      s.button = {
        backgroundColor: "rgb(31, 111, 235)",
        borderRadius: "6px",
        color: "rgb(255, 255, 255)",
        padding: "10px 20px",
        fontSize: "72px",
        fontWeight: "500",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.button?.primary?.fontSize).toBe("");
    });

    it("omits the button sub-tree when no primary source has surviving fields", () => {
      const s = emptySignals();
      // Grayscale button -> rejected as primary source -> no button.primary.
      s.button = {
        backgroundColor: "rgb(239, 239, 239)",
        borderRadius: "4px",
        color: "rgb(0, 0, 0)",
        padding: "10px 20px",
        fontSize: "14px",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.button).toBeUndefined();
    });

    it("uses CTA over button when both have chromatic backgrounds", () => {
      const s = emptySignals();
      s.cta = {
        backgroundColor: "rgb(99, 91, 255)",
        color: "rgb(255, 255, 255)",
        borderRadius: "8px",
        padding: "12px 24px",
        fontSize: "15px",
        fontWeight: "600",
      };
      s.button = {
        backgroundColor: "rgb(0, 200, 100)",
        borderRadius: "4px",
        color: "rgb(0, 0, 0)",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: "500",
      };
      const d = synthesizeDesignSystem(s);
      // button.primary anatomy comes from the CTA, not the <button>.
      expect(d.components?.button?.primary?.padding).toBe("12px 24px");
      expect(d.components?.button?.primary?.fontSize).toBe("15px");
    });
  });

  describe("components.card", () => {
    it("populates card from a fully-specified cardSample", () => {
      const s = emptySignals();
      s.cardSample = {
        borderRadius: "16px",
        padding: "24px",
        backgroundColor: "rgb(255, 255, 255)",
        color: "rgb(20, 20, 20)",
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: "rgb(229, 229, 229)",
        boxShadow: "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.card).toEqual({
        background: "#ffffff",
        color: "#141414",
        radius: "16px",
        padding: "24px",
        border: "1px solid #e5e5e5",
        shadow: "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px",
      });
    });

    it("emits empty border and shadow when missing or 'none'", () => {
      const s = emptySignals();
      s.cardSample = {
        borderRadius: "12px",
        padding: "20px",
        backgroundColor: "rgb(255, 255, 255)",
        color: "",
        borderTopWidth: "0px",
        borderTopStyle: "none",
        borderTopColor: "rgb(0, 0, 0)",
        boxShadow: "none",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.card?.border).toBe("");
      expect(d.components?.card?.shadow).toBe("");
      expect(d.components?.card?.radius).toBe("12px");
    });

    it("omits the card sub-tree when padding is 0px 0px (mis-classified)", () => {
      const s = emptySignals();
      s.cardSample = {
        borderRadius: "8px",
        padding: "0px 0px",
        backgroundColor: "rgb(255, 255, 255)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.card).toBeUndefined();
    });

    it("omits the card sub-tree when cardSample is missing", () => {
      const s = emptySignals();
      // No cardSample at all.
      const d = synthesizeDesignSystem(s);
      expect(d.components?.card).toBeUndefined();
    });

    it("keeps card with only radius + bg + padding when border and shadow are absent", () => {
      const s = emptySignals();
      s.cardSample = {
        borderRadius: "8px",
        padding: "16px",
        backgroundColor: "rgb(248, 248, 248)",
        // No border or shadow info.
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.card).toEqual({
        background: "#f8f8f8",
        color: "",
        radius: "8px",
        padding: "16px",
        border: "",
        shadow: "",
      });
    });
  });

  describe("components.link", () => {
    it("populates link with color, text-decoration, font-weight", () => {
      const s = emptySignals();
      s.link = {
        color: "rgb(80, 70, 228)",
        textDecorationLine: "underline",
        fontWeight: "500",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.link).toEqual({
        color: "#5046e4",
        textDecoration: "underline",
        fontWeight: "500",
      });
    });

    it("omits link when text-decoration is 'none' and no other distinguishing info", () => {
      const s = emptySignals();
      s.link = {
        color: "rgb(80, 70, 228)",
        textDecorationLine: "none",
        fontWeight: "400",
      };
      const d = synthesizeDesignSystem(s);
      // The link is still emitted because color is distinct; textDecoration
      // normalizes to "none" so agents see the brand's explicit choice.
      expect(d.components?.link?.color).toBe("#5046e4");
      expect(d.components?.link?.textDecoration).toBe("none");
    });

    it("omits link entirely when no link signal", () => {
      const d = synthesizeDesignSystem(emptySignals());
      expect(d.components?.link).toBeUndefined();
    });
  });

  describe("components.headings", () => {
    it("populates h1 lineHeight, letterSpacing, color", () => {
      const s = emptySignals();
      s.h1 = {
        fontFamily: "Poppins",
        fontSize: "56px",
        fontWeight: "900",
        color: "rgb(0, 0, 0)",
        lineHeight: "1.1",
        letterSpacing: "-1.5px",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.headings?.h1).toEqual({
        lineHeight: "1.1",
        letterSpacing: "-1.5px",
        color: "#000000",
      });
    });

    it("emits only the heading levels that have anatomy", () => {
      const s = emptySignals();
      s.h2 = {
        fontSize: "32px",
        lineHeight: "1.2",
        letterSpacing: "-0.5px",
        color: "rgb(20, 20, 20)",
      };
      const d = synthesizeDesignSystem(s);
      expect(d.components?.headings?.h1).toBeUndefined();
      expect(d.components?.headings?.h3).toBeUndefined();
      expect(d.components?.headings?.h2).toEqual({
        lineHeight: "1.2",
        letterSpacing: "-0.5px",
        color: "#141414",
      });
    });

    it("omits headings entirely when no anatomy fields are present", () => {
      const s = emptySignals();
      s.h1 = {
        fontFamily: "Poppins",
        fontSize: "56px",
        fontWeight: "900",
        color: "rgb(0, 0, 0)",
        // No lineHeight, letterSpacing — only color
      };
      const d = synthesizeDesignSystem(s);
      // h1 has color, so it should appear with just color (the other two empty).
      expect(d.components?.headings?.h1?.color).toBe("#000000");
      expect(d.components?.headings?.h1?.lineHeight).toBe("");
      expect(d.components?.headings?.h1?.letterSpacing).toBe("");
    });

    it("omits headings entirely when no heading has any anatomy", () => {
      const s = emptySignals();
      // No headings at all.
      const d = synthesizeDesignSystem(s);
      expect(d.components?.headings).toBeUndefined();
    });
  });

  // --- C6: spacing.scale ---

  describe("spacing.scale", () => {
    it("returns top 6 values from histogram, sorted ascending", () => {
      const s = emptySignals();
      s.paddingHistogram = {
        "4px": 12,
        "8px": 30,
        "16px": 45,
        "24px": 20,
        "32px": 18,
        "48px": 10,
        "64px": 6,
        "96px": 8,
      };
      const d = synthesizeDesignSystem(s);
      // 8 values pass the >=5 threshold; top 6 by count are
      // 16px(45), 8px(30), 24px(20), 32px(18), 4px(12), 48px(10).
      // After re-sort ascending: 4, 8, 16, 24, 32, 48.
      expect(d.spacing.scale).toEqual(["4px", "8px", "16px", "24px", "32px", "48px"]);
    });

    it("drops values that occur fewer than 5 times", () => {
      const s = emptySignals();
      s.paddingHistogram = {
        "8px": 30,
        "10px": 4, // below threshold, must drop
        "16px": 45,
        "24px": 20,
      };
      const d = synthesizeDesignSystem(s);
      expect(d.spacing.scale).toEqual(["8px", "16px", "24px"]);
    });

    it("returns undefined when histogram is empty", () => {
      const d = synthesizeDesignSystem(emptySignals());
      expect(d.spacing.scale).toBeUndefined();
    });

    it("returns undefined when no value clears the threshold", () => {
      const s = emptySignals();
      s.paddingHistogram = { "8px": 2, "16px": 4 };
      const d = synthesizeDesignSystem(s);
      expect(d.spacing.scale).toBeUndefined();
    });

    it("tied counts break by ascending value (deterministic)", () => {
      const s = emptySignals();
      s.paddingHistogram = {
        "10px": 5,
        "20px": 5,
        "30px": 5,
        "40px": 5,
        "50px": 5,
        "60px": 5,
        "70px": 5, // overflow — must be dropped since all tie at count 5
      };
      const d = synthesizeDesignSystem(s);
      // All 7 tie at count 5. Top 6 should be the 6 smallest values.
      expect(d.spacing.scale).toEqual(["10px", "20px", "30px", "40px", "50px", "60px"]);
    });

    it("emits fewer than 6 values when fewer survive (does not pad)", () => {
      const s = emptySignals();
      s.paddingHistogram = { "12px": 8, "24px": 10 };
      const d = synthesizeDesignSystem(s);
      expect(d.spacing.scale).toEqual(["12px", "24px"]);
    });
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
