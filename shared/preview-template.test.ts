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
      headingFontStack: '"Sohne Var", system-ui, sans-serif',
      bodyFontStack: '"Sohne Var", system-ui, sans-serif',
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
      headingFontStack: "",
      bodyFontStack: "",
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

  it("does NOT propagate a pill-like legacy radius to cards (cards fall through to 8px)", () => {
    const data = fullData();
    // Brand uses pills on buttons; we didn't extract a card sample. Cards
    // must not inherit "9999px" via the legacy borders.radius fallback —
    // that would render literal ovals. They fall through to "8px".
    data.borders.radius = "9999px";
    data.borders.radii = { button: "9999px", card: "", pill: "9999px" };
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-button-radius:\s*9999px/);
    expect(html).toMatch(/--ds-card-radius:\s*8px/);
  });

  it("treats percentage radii as pill-like for the card fallback", () => {
    const data = fullData();
    // 50% on a non-square card = ellipse — same risk as 9999px.
    data.borders.radius = "50%";
    data.borders.radii = { button: "50%", card: "", pill: "" };
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-button-radius:\s*50%/);
    expect(html).toMatch(/--ds-card-radius:\s*8px/);
  });

  it("uses the captured font-family stack verbatim for headings (no system-ui sandwich)", () => {
    const data = fullData();
    data.typography.headingFont = "Mackinac";
    data.typography.headingFontStack =
      'Mackinac, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
    const html = renderPreview(data);
    // The full brand-specified stack appears verbatim in the CSS variable —
    // no system-ui sneaking between the primary and the generic.
    expect(html).toContain(
      '--ds-heading-font: Mackinac, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;',
    );
    expect(html).not.toMatch(/--ds-heading-font:[^;]*system-ui[^;]*serif/);
  });

  it("preserves separate stacks for heading vs body", () => {
    const data = fullData();
    data.typography.headingFontStack = 'Mackinac, ui-serif, serif';
    data.typography.bodyFontStack =
      '"Fricolage Grotesque", ui-sans-serif, system-ui, sans-serif';
    const html = renderPreview(data);
    expect(html).toContain("--ds-heading-font: Mackinac, ui-serif, serif");
    expect(html).toContain(
      '--ds-body-font: "Fricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    );
  });

  it("falls back to primary + system-ui + sans-serif when no stack is captured", () => {
    const data = fullData();
    data.typography.headingFont = "Mystery Font";
    data.typography.headingFontStack = "";
    const html = renderPreview(data);
    expect(html).toMatch(
      /--ds-heading-font:\s*"Mystery Font",\s*system-ui,\s*sans-serif/,
    );
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

  // --- C5: components consumed by preview ---

  it("applies components.button.primary.padding to the button CSS rule", () => {
    const data = fullData();
    data.components = {
      button: {
        primary: {
          background: "#635bff",
          color: "#ffffff",
          radius: "6px",
          padding: "14px 28px",
          fontSize: "16px",
          fontWeight: "700",
          border: "",
        },
      },
    };
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-button-padding:\s*14px 28px/);
    expect(html).toMatch(/--ds-button-font-size:\s*16px/);
    expect(html).toMatch(/--ds-button-font-weight:\s*700/);
  });

  it("falls back to default button padding/font when components.button.primary is missing", () => {
    const html = renderPreview(fullData());
    // Defaults from preview-template stay in place when components is absent.
    expect(html).toMatch(/--ds-button-padding:\s*12px 22px/);
    expect(html).toMatch(/--ds-button-font-size:\s*15px/);
    expect(html).toMatch(/--ds-button-font-weight:\s*600/);
  });

  it("drops unsafe values via SAFE_* sanitization", () => {
    const data = fullData();
    data.components = {
      button: {
        primary: {
          background: "",
          color: "",
          radius: "",
          padding: "}; evil { width: 100",
          fontSize: "16em; injection",
          fontWeight: "abc",
          border: "javascript:alert(1)",
        },
      },
    };
    const html = renderPreview(data);
    // Sanitization must drop the bad values and use defaults instead.
    expect(html).toMatch(/--ds-button-padding:\s*12px 22px/);
    expect(html).toMatch(/--ds-button-font-size:\s*15px/);
    expect(html).toMatch(/--ds-button-font-weight:\s*600/);
    expect(html).not.toContain("javascript:alert");
    expect(html).not.toContain("evil");
  });

  it("applies components.card.padding and components.card.background", () => {
    const data = fullData();
    data.components = {
      card: {
        background: "#f5f5f5",
        color: "",
        radius: "12px",
        padding: "32px",
        border: "",
        shadow: "",
      },
    };
    const html = renderPreview(data);
    expect(html).toMatch(/--ds-card-padding:\s*32px/);
    expect(html).toMatch(/--ds-card-bg:\s*#f5f5f5/);
  });

  it("honors link.textDecoration: underline (only)", () => {
    const data = fullData();
    data.components = {
      link: {
        color: "#635bff",
        textDecoration: "underline",
        fontWeight: "500",
      },
    };
    const html = renderPreview(data);
    expect(html).toMatch(/text-decoration:\s*underline/);
  });

  it("renders identically to today when components is undefined (no new CSS rules added)", () => {
    const data = fullData();
    // No components field.
    const html = renderPreview(data);
    // Defaults appear, custom-property names exist but use fallback values.
    expect(html).toMatch(/--ds-button-padding:\s*12px 22px/);
    expect(html).toMatch(/--ds-card-padding:\s*24px/);
  });
});

describe("showcase — typography", () => {
  it("renders h1/h2/h3 samples with the brand heading font", () => {
    const data = fullData();
    const html = renderPreview(data, { title: "Acme" });
    expect(html).toContain("sc-type-sample");
    expect(html).toContain("The quick brown fox");
    expect(html).toContain("56px");
  });

  it("renders body text sample", () => {
    const data = fullData();
    const html = renderPreview(data, { title: "Acme" });
    expect(html).toContain("Body / Regular");
  });
});

describe("showcase — colors", () => {
  it("renders a swatch for each non-empty color", () => {
    const data = fullData();
    const html = renderPreview(data, { title: "Acme" });
    expect(html).toContain("ds-showcase");
    expect(html).toContain("#635bff"); // primary
    expect(html).toContain("Primary");
    expect(html).toContain("#ffffff"); // background
    expect(html).toContain("Background");
  });

  it("skips empty colors", () => {
    const data = fullData();
    data.colors.secondary = "";
    const html = renderPreview(data, { title: "Acme" });
    expect(html).not.toContain("Secondary");
  });

  it("sanitizes malicious color values in swatch style attribute", () => {
    const data = fullData();
    data.colors.primary = "red; background-image: url(https://exfil.example)";
    const html = renderPreview(data, { title: "Acme" });
    expect(html).not.toContain("background-image");
    expect(html).not.toContain("exfil");
  });
});

describe("showcase — spacing + radii", () => {
  it("renders spacing scale bars when scale is present", () => {
    const data = fullData();
    data.spacing.scale = ["4px", "8px", "16px", "24px", "32px"];
    const html = renderPreview(data, { title: "Acme" });
    expect(html).toContain("sc-spacing-bar");
    expect(html).toContain("8px");
  });

  it("omits spacing section when scale is empty", () => {
    const data = fullData();
    data.spacing.scale = [];
    const html = renderPreview(data, { title: "Acme" });
    expect(html).not.toContain("sc-spacing-bar");
  });

  it("renders radius swatches for button, card, pill", () => {
    const data = fullData();
    data.borders.radii = { button: "8px", card: "12px", pill: "999px" };
    const html = renderPreview(data, { title: "Acme" });
    expect(html).toContain("sc-radius-chip");
    expect(html).toContain("Button");
  });
});

describe("showcase — components", () => {
  it("renders live button with extracted styles", () => {
    const data = fullData();
    data.components = {
      button: { primary: { background: "#635bff", color: "#ffffff", radius: "6px", padding: "12px 22px", fontSize: "15px", fontWeight: "600", border: "" } },
    };
    const html = renderPreview(data, { title: "Acme" });
    expect(html).toContain("sc-component-section");
    expect(html).toContain("Get started");
  });

  it("omits component section when no components extracted", () => {
    const data = fullData();
    data.components = undefined;
    const html = renderPreview(data, { title: "Acme" });
    expect(html).not.toContain("sc-component-section");
  });
});

describe("showcase — design.md source", () => {
  it("renders raw design.md when opts.designMd is provided", () => {
    const data = fullData();
    const html = renderPreview(data, { title: "Acme", designMd: "---\nname: Acme\n---\n\n## Overview\n" });
    expect(html).toContain("sc-source-block");
    expect(html).toContain("name: Acme");
  });

  it("omits source block when opts.designMd is empty", () => {
    const data = fullData();
    const html = renderPreview(data, { title: "Acme" });
    expect(html).not.toContain("sc-source-block");
  });
});
