import { describe, expect, it } from "vitest";
import { designSystemToDesignMd } from "./design-md";
import type { DesignSystemData } from "./api";

const fullData: DesignSystemData = {
  colors: {
    primary: "#00E5FF",
    secondary: "#0EA5E9",
    accent: "#F97316",
    background: "#000000",
    surface: "#0A0A0A",
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.55)",
  },
  typography: {
    headingFont: "Poppins",
    bodyFont: "Poppins",
    headingFontGeneric: "",
    bodyFontGeneric: "",
    headingWeight: "900",
    bodyWeight: "400",
    headingSizes: { h1: "64px", h2: "40px", h3: "28px" },
  },
  spacing: { slidePadding: "80px 110px", elementGap: "20px" },
  borders: {
    radius: "12px",
    accentWidth: "4px",
    radii: { button: "", card: "", pill: "" },
  },
  slideDefaults: { background: "#000000", labelStyle: "uppercase" },
  logos: [],
};

describe("designSystemToDesignMd", () => {
  it("renders the full spec for a complete design system", () => {
    const md = designSystemToDesignMd({
      title: "Acme Brand",
      description: "Extracted from acme.com",
      data: fullData,
      customInstructions: "",
    });
    expect(md).toMatchInlineSnapshot(`
      "---
      name: Acme Brand
      description: Extracted from acme.com
      colors:
        primary: "#00E5FF"
        secondary: "#0EA5E9"
        accent: "#F97316"
        background: "#000000"
        surface: "#0A0A0A"
        text: "#FFFFFF"
        text-muted: "rgba(255,255,255,0.55)"
      typography:
        heading-1:
          fontFamily: Poppins
          fontSize: 64px
          fontWeight: 900
        heading-2:
          fontFamily: Poppins
          fontSize: 40px
          fontWeight: 900
        heading-3:
          fontFamily: Poppins
          fontSize: 28px
          fontWeight: 900
        body:
          fontFamily: Poppins
          fontWeight: 400
      rounded:
        md: 12px
      ---

      ## Overview

      Extracted from acme.com.

      ## Colors

      - **Primary** — \`{colors.primary}\` — \`#00E5FF\`
      - **Secondary** — \`{colors.secondary}\` — \`#0EA5E9\`
      - **Accent** — \`{colors.accent}\` — \`#F97316\`
      - **Background** — \`{colors.background}\` — \`#000000\`
      - **Surface** — \`{colors.surface}\` — \`#0A0A0A\`
      - **Text** — \`{colors.text}\` — \`#FFFFFF\`
      - **Text Muted** — \`{colors.text-muted}\` — \`rgba(255,255,255,0.55)\`

      ## Typography

      - **Headings** — \`Poppins\`, weight \`900\`. Sizes: h1 64px / h2 40px / h3 28px.
      - **Body** — \`Poppins\`, weight \`400\`.

      ## Layout

      - Slide padding: \`80px 110px\`
      - Element gap: \`20px\`

      ## Shapes

      - Border radius: \`12px\`
      - Accent stripe width: \`4px\`
      "
    `);
  });

  it("omits the rounded group and Border radius bullet when radius is empty but accentWidth is set", () => {
    const md = designSystemToDesignMd({
      title: "No Radius",
      description: "",
      data: {
        ...fullData,
        borders: {
          radius: "",
          accentWidth: "0",
          radii: { button: "", card: "", pill: "" },
        },
      },
      customInstructions: "",
    });
    expect(md).not.toMatch(/^rounded:/m);
    expect(md).not.toMatch(/Border radius:/);
  });

  it("includes custom instructions in the overview when present", () => {
    const md = designSystemToDesignMd({
      title: "Acme",
      description: "Acme spec",
      data: fullData,
      customInstructions: "Always use sentence case.",
    });
    expect(md).toMatch(/Custom instructions: Always use sentence case\./);
  });

  it("coerces numeric weights to numbers, leaves strings quoted", () => {
    const md = designSystemToDesignMd({
      title: "Weights",
      description: "",
      data: {
        ...fullData,
        typography: { ...fullData.typography, headingWeight: "bold", bodyWeight: "400" },
      },
      customInstructions: "",
    });
    expect(md).toMatch(/fontWeight: "bold"/);
    expect(md).toMatch(/fontWeight: 400/);
  });

  it("does not append a period when description already ends with ! or ?", () => {
    const md = designSystemToDesignMd({
      title: "Q",
      description: "Is this the right brand?",
      data: fullData,
      customInstructions: "",
    });
    expect(md).toMatch(/Is this the right brand\?\n/);
    expect(md).not.toMatch(/right brand\?\./);
  });

  it("skips heading-N blocks when font, size, and weight are all empty", () => {
    const md = designSystemToDesignMd({
      title: "Empty headings",
      description: "",
      data: {
        ...fullData,
        typography: {
          headingFont: "",
          bodyFont: "Poppins",
          headingFontGeneric: "",
          bodyFontGeneric: "",
          headingWeight: "",
          bodyWeight: "400",
          headingSizes: { h1: "", h2: "", h3: "" },
        },
      },
      customInstructions: "",
    });
    expect(md).not.toMatch(/heading-1:/);
    expect(md).not.toMatch(/heading-2:/);
    expect(md).not.toMatch(/heading-3:/);
    expect(md).toMatch(/body:/);
  });

  it("skips the body YAML block when bodyFont and bodyWeight are both empty", () => {
    const md = designSystemToDesignMd({
      title: "No body",
      description: "",
      data: {
        ...fullData,
        typography: {
          ...fullData.typography,
          bodyFont: "",
          bodyWeight: "",
        },
      },
      customInstructions: "",
    });
    // body: should not be emitted as a bare YAML key with no children
    expect(md).not.toMatch(/^ {2}body:\s*$/m);
  });

  it("skips the Colors and Typography prose sections when all source fields are empty", () => {
    const md = designSystemToDesignMd({
      title: "Empty",
      description: "",
      data: {
        ...fullData,
        colors: {
          primary: "", secondary: "", accent: "", background: "",
          surface: "", text: "", textMuted: "",
        },
        typography: {
          headingFont: "", bodyFont: "",
          headingFontGeneric: "", bodyFontGeneric: "",
          headingWeight: "", bodyWeight: "",
          headingSizes: { h1: "", h2: "", h3: "" },
        },
      },
      customInstructions: "",
    });
    expect(md).not.toMatch(/^## Colors$/m);
    expect(md).not.toMatch(/^## Typography$/m);
  });

  it("emits the semantic rounded block when radii.button/card/pill are populated", () => {
    const md = designSystemToDesignMd({
      title: "Pill Brand",
      description: "",
      data: {
        ...fullData,
        borders: {
          radius: "12px",
          accentWidth: "0",
          radii: { button: "9999px", card: "8px", pill: "9999px" },
        },
      },
      customInstructions: "",
    });
    expect(md).toMatch(/^rounded:$/m);
    expect(md).toMatch(/^  md: 12px$/m);
    expect(md).toMatch(/^  button: 9999px$/m);
    expect(md).toMatch(/^  card: 8px$/m);
    expect(md).toMatch(/^  pill: 9999px$/m);
  });

  it("omits empty semantic radii keys but keeps populated ones", () => {
    const md = designSystemToDesignMd({
      title: "Partial",
      description: "",
      data: {
        ...fullData,
        borders: {
          radius: "12px",
          accentWidth: "0",
          radii: { button: "9999px", card: "", pill: "" },
        },
      },
      customInstructions: "",
    });
    expect(md).toMatch(/^  md: 12px$/m);
    expect(md).toMatch(/^  button: 9999px$/m);
    expect(md).not.toMatch(/^  card:/m);
    expect(md).not.toMatch(/^  pill:/m);
  });

  it("emits the rounded block when only semantic radii are set (no legacy md:)", () => {
    const md = designSystemToDesignMd({
      title: "New Only",
      description: "",
      data: {
        ...fullData,
        borders: {
          radius: "",
          accentWidth: "0",
          radii: { button: "10px", card: "8px", pill: "" },
        },
      },
      customInstructions: "",
    });
    expect(md).toMatch(/^rounded:$/m);
    expect(md).not.toMatch(/^  md:/m);
    expect(md).toMatch(/^  button: 10px$/m);
    expect(md).toMatch(/^  card: 8px$/m);
  });
});
