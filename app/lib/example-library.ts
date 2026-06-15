import type { DesignSystemData } from "@shared/api";
import { GENERATED_EXAMPLE_ARTIFACTS } from "./generated-example-artifacts";

type TypographyInput = Partial<DesignSystemData["typography"]>;
type SpacingInput = Partial<DesignSystemData["spacing"]>;
type BorderInput = Partial<DesignSystemData["borders"]>;
type ComponentInput = DesignSystemData["components"];

export interface ExampleDesignSeed {
  slug: string;
  title: string;
  sourceUrl: string;
  category: string;
  description: string;
  bestFor: string;
  data: DesignSystemData;
}

export interface ExampleDesignArtifact extends ExampleDesignSeed {
  domain: string;
  logoPath: string;
  markdown: string;
  enrichedMarkdown: string;
}

const EXAMPLE_LOGO_EXTENSIONS: Record<string, "svg" | "png"> = {
  walmart: "png",
};

function buildDesignData(input: {
  colors: DesignSystemData["colors"];
  typography?: TypographyInput;
  spacing?: SpacingInput;
  borders?: BorderInput;
  components?: ComponentInput;
}): DesignSystemData {
  const typography: DesignSystemData["typography"] = {
    headingFont: "Inter",
    bodyFont: "Inter",
    headingFontStack: "Inter, ui-sans-serif, system-ui, sans-serif",
    bodyFontStack: "Inter, ui-sans-serif, system-ui, sans-serif",
    headingWeight: "700",
    bodyWeight: "400",
    headingSizes: { h1: "48px", h2: "32px", h3: "22px" },
    ...input.typography,
  };

  return {
    colors: input.colors,
    typography,
    spacing: {
      slidePadding: "48px",
      elementGap: "24px",
      scale: ["4px", "8px", "12px", "16px", "24px", "32px", "48px"],
      ...input.spacing,
    },
    borders: {
      radius: "12px",
      accentWidth: "4px",
      radii: { button: "999px", card: "16px", pill: "999px" },
      ...input.borders,
    },
    slideDefaults: {
      background: input.colors.background,
      labelStyle: "uppercase",
    },
    logos: [],
    components: input.components,
  };
}

function hostFromUrl(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function logoPathForSlug(slug: string): string {
  const extension = EXAMPLE_LOGO_EXTENSIONS[slug] ?? "svg";
  return `/assets/examples/logos/${slug}.${extension}`;
}

export const EXAMPLE_DESIGN_SEEDS: ExampleDesignSeed[] = [
  {
    slug: "stripe",
    title: "Stripe",
    sourceUrl: "https://stripe.com",
    category: "Developer platform",
    description:
      "A crisp developer-commerce system with cool surfaces, dense technical copy, and high-energy violet actions.",
    bestFor: "API docs, B2B SaaS, fintech onboarding, and checkout flows.",
    data: buildDesignData({
      colors: {
        primary: "#635BFF",
        secondary: "#0A2540",
        accent: "#00D4FF",
        background: "#F6F9FC",
        surface: "#FFFFFF",
        text: "#0A2540",
        textMuted: "#425466",
      },
      typography: {
        headingFont: "Inter",
        bodyFont: "Inter",
        headingWeight: "700",
        headingSizes: { h1: "56px", h2: "36px", h3: "24px" },
      },
      borders: {
        radius: "8px",
        accentWidth: "3px",
        radii: { button: "18px", card: "12px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#635BFF",
            color: "#FFFFFF",
            radius: "18px",
            padding: "10px 16px",
            fontSize: "15px",
            fontWeight: "700",
            border: "1px solid #635BFF",
          },
        },
        card: {
          background: "#FFFFFF",
          color: "#0A2540",
          radius: "12px",
          padding: "28px",
          border: "1px solid #D9E2EF",
          shadow: "0 18px 45px rgba(50, 50, 93, 0.12)",
        },
        link: {
          color: "#635BFF",
          textDecoration: "none",
          fontWeight: "700",
        },
      },
    }),
  },
  {
    slug: "intuit",
    title: "Intuit",
    sourceUrl: "https://www.intuit.com",
    category: "Fortune 500",
    description:
      "A practical financial-product system with bright blue actions, trustworthy green accents, and soft utility panels.",
    bestFor: "Fintech dashboards, SMB tools, support flows, and account setup.",
    data: buildDesignData({
      colors: {
        primary: "#236CFF",
        secondary: "#0D333F",
        accent: "#2CA01C",
        background: "#F7FBFF",
        surface: "#FFFFFF",
        text: "#111827",
        textMuted: "#5F6368",
      },
      typography: {
        headingFont: "Avenir Next",
        bodyFont: "Avenir Next",
        headingFontStack: "Avenir Next, Inter, ui-sans-serif, system-ui, sans-serif",
        bodyFontStack: "Avenir Next, Inter, ui-sans-serif, system-ui, sans-serif",
        headingWeight: "700",
      },
      components: {
        button: {
          primary: {
            background: "#236CFF",
            color: "#FFFFFF",
            radius: "6px",
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "700",
            border: "1px solid #236CFF",
          },
        },
        card: {
          background: "#FFFFFF",
          color: "#111827",
          radius: "8px",
          padding: "24px",
          border: "1px solid #D8E2EF",
          shadow: "0 6px 18px rgba(17, 24, 39, 0.08)",
        },
      },
    }),
  },
  {
    slug: "walmart",
    title: "Walmart",
    sourceUrl: "https://www.walmart.com",
    category: "Fortune 500",
    description:
      "A high-contrast retail system with confident blue navigation, yellow emphasis, and compact commerce cards.",
    bestFor: "Retail search, marketplace grids, inventory views, and promotion-heavy flows.",
    data: buildDesignData({
      colors: {
        primary: "#0071CE",
        secondary: "#041E42",
        accent: "#FFC220",
        background: "#FFFFFF",
        surface: "#F7F8FA",
        text: "#1E293B",
        textMuted: "#64748B",
      },
      typography: {
        headingFont: "Bogle",
        bodyFont: "Bogle",
        headingFontStack: "Bogle, Arial, ui-sans-serif, system-ui, sans-serif",
        bodyFontStack: "Bogle, Arial, ui-sans-serif, system-ui, sans-serif",
        headingSizes: { h1: "48px", h2: "30px", h3: "20px" },
      },
      borders: {
        radius: "8px",
        accentWidth: "4px",
        radii: { button: "999px", card: "12px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#0071CE",
            color: "#FFFFFF",
            radius: "999px",
            padding: "12px 22px",
            fontSize: "16px",
            fontWeight: "700",
            border: "1px solid #0071CE",
          },
        },
        card: {
          background: "#FFFFFF",
          color: "#1E293B",
          radius: "12px",
          padding: "18px",
          border: "1px solid #E2E8F0",
          shadow: "0 4px 14px rgba(4, 30, 66, 0.08)",
        },
      },
    }),
  },
  {
    slug: "apple",
    title: "Apple",
    sourceUrl: "https://www.apple.com",
    category: "Fortune 500",
    description:
      "A restraint-first product system with quiet gray surfaces, large confident type, and minimal blue actions.",
    bestFor: "Hardware pages, product launches, premium landing pages, and feature storytelling.",
    data: buildDesignData({
      colors: {
        primary: "#0071E3",
        secondary: "#1D1D1F",
        accent: "#86868B",
        background: "#F5F5F7",
        surface: "#FFFFFF",
        text: "#1D1D1F",
        textMuted: "#6E6E73",
      },
      typography: {
        headingFont: "SF Pro Display",
        bodyFont: "SF Pro Text",
        headingFontStack: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
        bodyFontStack: "SF Pro Text, -apple-system, BlinkMacSystemFont, sans-serif",
        headingWeight: "700",
        bodyWeight: "400",
        headingSizes: { h1: "64px", h2: "40px", h3: "24px" },
      },
      spacing: {
        slidePadding: "64px",
        elementGap: "28px",
      },
      borders: {
        radius: "18px",
        accentWidth: "2px",
        radii: { button: "999px", card: "24px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#0071E3",
            color: "#FFFFFF",
            radius: "999px",
            padding: "10px 20px",
            fontSize: "16px",
            fontWeight: "500",
            border: "1px solid #0071E3",
          },
        },
        card: {
          background: "#FFFFFF",
          color: "#1D1D1F",
          radius: "24px",
          padding: "32px",
          border: "1px solid #E5E5EA",
          shadow: "0 16px 36px rgba(0, 0, 0, 0.08)",
        },
      },
    }),
  },
  {
    slug: "shopify",
    title: "Shopify",
    sourceUrl: "https://www.shopify.com",
    category: "Commerce platform",
    description:
      "A merchant-focused commerce system with deep green anchors, approachable surfaces, and direct conversion controls.",
    bestFor: "Commerce onboarding, merchant dashboards, pricing pages, and growth tooling.",
    data: buildDesignData({
      colors: {
        primary: "#008060",
        secondary: "#004C3F",
        accent: "#95BF47",
        background: "#F6F6F7",
        surface: "#FFFFFF",
        text: "#202223",
        textMuted: "#6D7175",
      },
      typography: {
        headingFont: "Inter",
        bodyFont: "Inter",
        headingWeight: "700",
      },
      borders: {
        radius: "8px",
        accentWidth: "4px",
        radii: { button: "4px", card: "12px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#008060",
            color: "#FFFFFF",
            radius: "4px",
            padding: "12px 18px",
            fontSize: "16px",
            fontWeight: "700",
            border: "1px solid #008060",
          },
        },
        link: {
          color: "#008060",
          textDecoration: "none",
          fontWeight: "700",
        },
      },
    }),
  },
  {
    slug: "vercel",
    title: "Vercel",
    sourceUrl: "https://vercel.com",
    category: "Developer platform",
    description:
      "A monochrome developer system with surgical spacing, code-like rhythm, and sparse high-confidence surfaces.",
    bestFor: "Developer tools, deployment dashboards, docs, and technical product pages.",
    data: buildDesignData({
      colors: {
        primary: "#000000",
        secondary: "#111111",
        accent: "#666666",
        background: "#FFFFFF",
        surface: "#FAFAFA",
        text: "#000000",
        textMuted: "#666666",
      },
      typography: {
        headingFont: "Geist",
        bodyFont: "Geist",
        headingFontStack: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
        bodyFontStack: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
        headingWeight: "600",
        headingSizes: { h1: "52px", h2: "34px", h3: "22px" },
      },
      borders: {
        radius: "6px",
        accentWidth: "1px",
        radii: { button: "6px", card: "8px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#000000",
            color: "#FFFFFF",
            radius: "6px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: "600",
            border: "1px solid #000000",
          },
        },
        card: {
          background: "#FAFAFA",
          color: "#000000",
          radius: "8px",
          padding: "24px",
          border: "1px solid #EAEAEA",
          shadow: "none",
        },
      },
    }),
  },
  {
    slug: "airbnb",
    title: "Airbnb",
    sourceUrl: "https://www.airbnb.com",
    category: "Marketplace",
    description:
      "A human marketplace system with coral actions, rounded cards, warm imagery space, and approachable product copy.",
    bestFor: "Travel search, marketplace listings, trust flows, and consumer booking experiences.",
    data: buildDesignData({
      colors: {
        primary: "#FF385C",
        secondary: "#222222",
        accent: "#00A699",
        background: "#FFFFFF",
        surface: "#F7F7F7",
        text: "#222222",
        textMuted: "#717171",
      },
      typography: {
        headingFont: "Circular",
        bodyFont: "Circular",
        headingFontStack: "Circular, Inter, ui-sans-serif, system-ui, sans-serif",
        bodyFontStack: "Circular, Inter, ui-sans-serif, system-ui, sans-serif",
        headingSizes: { h1: "54px", h2: "34px", h3: "22px" },
      },
      borders: {
        radius: "16px",
        accentWidth: "3px",
        radii: { button: "8px", card: "18px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#FF385C",
            color: "#FFFFFF",
            radius: "8px",
            padding: "13px 22px",
            fontSize: "16px",
            fontWeight: "700",
            border: "1px solid #FF385C",
          },
        },
        card: {
          background: "#FFFFFF",
          color: "#222222",
          radius: "18px",
          padding: "20px",
          border: "1px solid #DDDDDD",
          shadow: "0 8px 24px rgba(34, 34, 34, 0.08)",
        },
      },
    }),
  },
  {
    slug: "nike",
    title: "Nike",
    sourceUrl: "https://www.nike.com",
    category: "Fortune 500",
    description:
      "A direct athletic retail system with bold monochrome contrast, punchy orange moments, and oversized display scale.",
    bestFor: "Launch pages, retail drops, performance product pages, and editorial campaigns.",
    data: buildDesignData({
      colors: {
        primary: "#111111",
        secondary: "#FFFFFF",
        accent: "#FA5400",
        background: "#F5F5F5",
        surface: "#FFFFFF",
        text: "#111111",
        textMuted: "#737373",
      },
      typography: {
        headingFont: "Helvetica Neue",
        bodyFont: "Helvetica Neue",
        headingFontStack: "Helvetica Neue, Arial, ui-sans-serif, system-ui, sans-serif",
        bodyFontStack: "Helvetica Neue, Arial, ui-sans-serif, system-ui, sans-serif",
        headingWeight: "800",
        headingSizes: { h1: "68px", h2: "42px", h3: "24px" },
      },
      spacing: {
        slidePadding: "56px",
        elementGap: "20px",
      },
      borders: {
        radius: "2px",
        accentWidth: "5px",
        radii: { button: "999px", card: "4px", pill: "999px" },
      },
      components: {
        button: {
          primary: {
            background: "#111111",
            color: "#FFFFFF",
            radius: "999px",
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "700",
            border: "1px solid #111111",
          },
        },
        card: {
          background: "#FFFFFF",
          color: "#111111",
          radius: "4px",
          padding: "24px",
          border: "1px solid #E5E5E5",
          shadow: "none",
        },
      },
    }),
  },
];

export const EXAMPLE_DESIGNS: ExampleDesignArtifact[] =
  EXAMPLE_DESIGN_SEEDS.map((example) => {
    const generated = GENERATED_EXAMPLE_ARTIFACTS[example.slug];
    if (!generated) {
      throw new Error(`Missing generated example artifact for ${example.slug}`);
    }
    const sourceUrl = generated.sourceUrl || example.sourceUrl;
    const domain = hostFromUrl(sourceUrl);
    const logoPath = logoPathForSlug(example.slug);
    return {
      ...example,
      sourceUrl,
      data: {
        ...generated.designSystemData,
        logos: [{ url: logoPath, name: example.title, variant: "auto" }],
      },
      domain,
      logoPath,
      markdown: generated.markdown,
      enrichedMarkdown: generated.enrichedMarkdown,
    };
  });

export function getExampleDesignBySlug(
  slug: string | undefined,
): ExampleDesignArtifact | null {
  if (!slug) return null;
  return EXAMPLE_DESIGNS.find((example) => example.slug === slug) ?? null;
}

export function getHomepageExamples(): ExampleDesignArtifact[] {
  return EXAMPLE_DESIGNS.slice(0, 5);
}
