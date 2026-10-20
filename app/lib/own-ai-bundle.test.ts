import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createOwnAiBundle, type OwnAiExtraction } from "./own-ai-bundle";

const screenshot =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const extraction: OwnAiExtraction = {
  url: "https://example.com/landing",
  markdown: "# Café design\n\nMeasured color: #123456\n",
  designSystemData: {
    colors: {
      primary: "#123456",
      secondary: "#eeeeee",
      accent: "#123456",
      background: "#ffffff",
      surface: "#eeeeee",
      text: "#111111",
      textMuted: "#555555",
    },
    typography: {
      headingFont: "Arial",
      bodyFont: "Arial",
      headingFontStack: "Arial, sans-serif",
      bodyFontStack: "Arial, sans-serif",
      headingWeight: "700",
      bodyWeight: "400",
      headingSizes: { h1: "48px", h2: "32px", h3: "24px" },
    },
    spacing: { slidePadding: "32px", elementGap: "16px" },
    borders: {
      radius: "12px",
      accentWidth: "1px",
      radii: { button: "12px", card: "12px", pill: "999px" },
    },
    slideDefaults: { background: "#ffffff", labelStyle: "none" },
    logos: [],
  },
  signals: {
    title: "Café",
    cssVars: { "--brand": "#123456" },
    button: {
      backgroundColor: "#123456",
      color: "#ffffff",
      borderRadius: "12px",
      padding: "8px 16px",
    },
  },
  screenshotDataUrl: `data:image/png;base64,${screenshot}`,
  diagnostics: { requestId: "test-capture", warnings: ["screenshot_viewport"] },
};

describe("own AI bundle", () => {
  it("exports the original evidence and instructions as an ordinary ZIP", async () => {
    const original = structuredClone(extraction);
    const { blob, filename } = createOwnAiBundle(extraction);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect(filename).toBe("example.com-ai-bundle.zip");
    expect(blob.type).toBe("application/zip");
    expect(Object.keys(files).sort()).toEqual([
      "ENRICHMENT.md",
      "README.md",
      "design.md",
      "extraction.json",
      "screenshot.png",
    ]);
    expect(strFromU8(files["design.md"])).toBe(original.markdown);
    expect(files["screenshot.png"]).toEqual(
      new Uint8Array(Buffer.from(screenshot, "base64")),
    );
    const measurements = JSON.parse(strFromU8(files["extraction.json"]));
    expect(measurements).toMatchObject({
      schemaVersion: 1,
      url: original.url,
      viewport: { width: 1280, height: 800 },
      markdown: original.markdown,
      designSystemData: original.designSystemData,
      signals: original.signals,
      diagnostics: original.diagnostics,
      screenshot: "screenshot.png",
    });
    expect(measurements).not.toHaveProperty("screenshotDataUrl");
    expect(strFromU8(files["ENRICHMENT.md"])).toContain("Do not invent");
    expect(strFromU8(files["README.md"])).toContain("Follow ENRICHMENT.md");
    expect(extraction).toEqual(original);
  });

  it("keeps a cached extraction usable when the screenshot or signals are missing", async () => {
    const { blob } = createOwnAiBundle({
      ...extraction,
      screenshotDataUrl: undefined,
      signals: undefined,
    });
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(files).not.toHaveProperty("screenshot.png");
    expect(JSON.parse(strFromU8(files["extraction.json"]))).toMatchObject({
      screenshot: null,
      signals: null,
    });
    expect(strFromU8(files["README.md"])).toContain("Screenshot unavailable");
  });

  it("rejects an unreadable screenshot instead of downloading a broken image", () => {
    expect(() =>
      createOwnAiBundle({
        ...extraction,
        screenshotDataUrl: "https://example.com/image.png",
      }),
    ).toThrow("screenshot could not be read");
  });
});
