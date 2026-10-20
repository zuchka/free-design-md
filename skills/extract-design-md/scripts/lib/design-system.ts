export interface DesignSystemData {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingFontStack: string;
    bodyFontStack: string;
    headingWeight: string;
    bodyWeight: string;
    headingSizes: { h1: string; h2: string; h3: string };
  };
  spacing: { slidePadding: string; elementGap: string; scale?: string[] };
  borders: {
    radius: string;
    accentWidth: string;
    radii: { button: string; card: string; pill: string };
  };
  slideDefaults: {
    background: string;
    labelStyle: "uppercase" | "lowercase" | "capitalize" | "none";
  };
  logos: { url: string; name: string; variant: "light" | "dark" | "auto" }[];
  imageStyle?: {
    referenceUrls: string[];
    styleDescription: string;
  };
  customCSS?: string;
  notes?: string;
  // Per-component anatomy extracted deterministically from the same elements
  // we already sample for tokens. Each sub-tree is omitted when no surviving
  // fields make it through the plausibility filter. Empty stays empty — we
  // do not fabricate values we cannot see on the page.
  components?: {
    button?: {
      primary?: {
        background: string;
        color: string;
        radius: string;
        padding: string;
        fontSize: string;
        fontWeight: string;
        border: string;
      };
    };
    card?: {
      background: string;
      color: string;
      radius: string;
      padding: string;
      border: string;
      shadow: string;
    };
    link?: {
      color: string;
      textDecoration: string;
      fontWeight: string;
    };
    headings?: {
      h1?: { lineHeight: string; letterSpacing: string; color: string };
      h2?: { lineHeight: string; letterSpacing: string; color: string };
      h3?: { lineHeight: string; letterSpacing: string; color: string };
    };
  };
}
