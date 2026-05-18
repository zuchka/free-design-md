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
    headingWeight: "900",
    bodyWeight: "400",
    headingSizes: { h1: "64px", h2: "40px", h3: "28px" },
  },
  spacing: { slidePadding: "80px 110px", elementGap: "20px" },
  borders: { radius: "12px", accentWidth: "4px" },
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

  it("omits the rounded group and shapes line when radius is missing", () => {
    const md = designSystemToDesignMd({
      title: "No Radius",
      description: "",
      data: { ...fullData, borders: { radius: "", accentWidth: "0" } },
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
});
