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
    headingFontStack: "",
    bodyFontStack: "",
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
          headingFontStack: "",
          bodyFontStack: "",
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
          headingFontStack: "", bodyFontStack: "",
          headingWeight: "", bodyWeight: "",
          headingSizes: { h1: "", h2: "", h3: "" },
        },
      },
      customInstructions: "",
    });
    expect(md).not.toMatch(/^## Colors$/m);
    expect(md).not.toMatch(/^## Typography$/m);
  });

  it("emits fontFamilyStack lines under heading-N and body when stacks are present", () => {
    const md = designSystemToDesignMd({
      title: "Fly",
      description: "",
      data: {
        ...fullData,
        typography: {
          ...fullData.typography,
          headingFont: "Mackinac",
          bodyFont: "Fricolage Grotesque",
          headingFontStack:
            'Mackinac, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
          bodyFontStack:
            '"Fricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
        },
      },
      customInstructions: "",
    });
    expect(md).toMatch(
      /^ {4}fontFamilyStack: "Mackinac, ui-serif, Georgia, Cambria, \\"Times New Roman\\", Times, serif"$/m,
    );
    expect(md).toMatch(
      /^ {4}fontFamilyStack: "\\"Fricolage Grotesque\\", ui-sans-serif, system-ui, sans-serif"$/m,
    );
  });

  it("omits fontFamilyStack when the stack equals the primary font name (single-name brand)", () => {
    const md = designSystemToDesignMd({
      title: "Single",
      description: "",
      data: {
        ...fullData,
        typography: {
          ...fullData.typography,
          headingFont: "Mackinac",
          headingFontStack: "Mackinac",
        },
      },
      customInstructions: "",
    });
    expect(md).not.toMatch(/fontFamilyStack:/);
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

  // --- C5: components block ---

  it("emits a components: YAML block and ## Components prose section when populated", () => {
    const md = designSystemToDesignMd({
      title: "Acme",
      description: "Spec",
      data: {
        ...fullData,
        components: {
          button: {
            primary: {
              background: "#5046E4",
              color: "#FFFFFF",
              radius: "9999px",
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: "600",
              border: "",
            },
          },
          card: {
            background: "#FFFFFF",
            color: "#141414",
            radius: "16px",
            padding: "24px",
            border: "1px solid #E5E5E5",
            shadow: "",
          },
          link: {
            color: "#5046E4",
            textDecoration: "underline",
            fontWeight: "500",
          },
          headings: {
            h1: { lineHeight: "1.1", letterSpacing: "-1.5px", color: "#000000" },
          },
        },
      },
      customInstructions: "",
    });
    // YAML block
    expect(md).toMatch(/^components:$/m);
    expect(md).toMatch(/^  button:$/m);
    expect(md).toMatch(/^    primary:$/m);
    expect(md).toMatch(/^      background: "#5046E4"$/m);
    expect(md).toMatch(/^      radius: 9999px$/m);
    expect(md).toMatch(/^      padding: "12px 24px"$/m);
    expect(md).toMatch(/^      fontSize: 15px$/m);
    expect(md).toMatch(/^      fontWeight: 600$/m);
    expect(md).toMatch(/^  card:$/m);
    expect(md).toMatch(/^    border: "1px solid #E5E5E5"$/m);
    expect(md).toMatch(/^  link:$/m);
    expect(md).toMatch(/^    textDecoration: underline$/m);
    expect(md).toMatch(/^  headings:$/m);
    expect(md).toMatch(/^    h1:$/m);
    expect(md).toMatch(/^      lineHeight: 1\.1$/m);
    // Prose section
    expect(md).toMatch(/^## Components$/m);
    expect(md).toMatch(/^### Button \(primary\)$/m);
    expect(md).toMatch(/^### Card$/m);
    expect(md).toMatch(/^### Link$/m);
    expect(md).toMatch(/^### Headings$/m);
  });

  it("omits the components: block and prose section when components is undefined", () => {
    const md = designSystemToDesignMd({
      title: "No components",
      description: "",
      data: fullData,
      customInstructions: "",
    });
    expect(md).not.toMatch(/^components:$/m);
    expect(md).not.toMatch(/^## Components$/m);
  });

  it("emits only populated component sub-trees", () => {
    const md = designSystemToDesignMd({
      title: "Button only",
      description: "",
      data: {
        ...fullData,
        components: {
          button: {
            primary: {
              background: "#5046E4",
              color: "#FFFFFF",
              radius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "600",
              border: "",
            },
          },
        },
      },
      customInstructions: "",
    });
    expect(md).toMatch(/^  button:$/m);
    expect(md).not.toMatch(/^  card:$/m);
    expect(md).not.toMatch(/^  link:$/m);
    expect(md).not.toMatch(/^  headings:$/m);
    expect(md).toMatch(/^### Button \(primary\)$/m);
    expect(md).not.toMatch(/^### Card$/m);
  });

  it("skips empty fields inside a populated sub-tree (e.g. empty border)", () => {
    const md = designSystemToDesignMd({
      title: "Bare button",
      description: "",
      data: {
        ...fullData,
        components: {
          button: {
            primary: {
              background: "#5046E4",
              color: "#FFFFFF",
              radius: "8px",
              padding: "",
              fontSize: "",
              fontWeight: "",
              border: "",
            },
          },
        },
      },
      customInstructions: "",
    });
    expect(md).toMatch(/^      background: "#5046E4"$/m);
    expect(md).not.toMatch(/^ {6}padding:/m);
    expect(md).not.toMatch(/^ {6}fontSize:/m);
    expect(md).not.toMatch(/^ {6}border:/m);
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
