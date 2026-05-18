import { defineAction } from "@agent-native/core";
import { z } from "zod";
import { chromium } from "playwright";
import { designSystemToDesignMd } from "../shared/design-md.js";
import {
  synthesizeDesignSystem,
  type ExtractedSignals,
} from "../shared/extract-design-system.js";

function assertSafeUrl(rawUrl: string): URL {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }
  const hostname = parsed.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.16.") ||
    hostname.startsWith("172.17.") ||
    hostname.startsWith("172.18.") ||
    hostname.startsWith("172.19.") ||
    hostname.startsWith("172.2") ||
    hostname.startsWith("172.30.") ||
    hostname.startsWith("172.31.") ||
    hostname.startsWith("192.168.") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal" ||
    hostname === "169.254.169.254"
  ) {
    throw new Error("Internal/private URLs are not allowed");
  }
  return parsed;
}

export default defineAction({
  description:
    "Headlessly visit a URL with Playwright, collect computed CSS signals, " +
    "and render a design.md spec. Deterministic — no LLM, no agent. CLI-only.",
  schema: z.object({
    url: z.string().describe("URL of the page to extract a design system from"),
  }),
  readOnly: true,
  run: async ({ url }) => {
    const target = assertSafeUrl(url);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      // SWC's keepNames transform injects __name(fn, "...") calls into compiled
      // arrow functions. Those calls survive into the function string we pass to
      // page.evaluate, where __name is undefined. Stub it in the page context.
      await page.addInitScript(
        "if (typeof globalThis.__name === 'undefined') { globalThis.__name = function (f) { return f; }; }",
      );
      await page.goto(target.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 10_000,
      });
      // Brief buffer for late-rendered fonts/colors that fire after DOMContentLoaded.
      await page.waitForTimeout(1_000);

      const signals = (await page.evaluate(() => {
        const body = document.body;
        if (!body) {
          return null;
        }
        const bodyStyle = getComputedStyle(body);
        const htmlStyle = getComputedStyle(document.documentElement);

        const computedH = (el: Element | null) =>
          el
            ? {
                fontFamily: getComputedStyle(el).fontFamily,
                fontSize: getComputedStyle(el).fontSize,
                fontWeight: getComputedStyle(el).fontWeight,
                color: getComputedStyle(el).color,
              }
            : null;

        // A "non-transparent" bg means the element is visually filled
        // (rules out untouched defaults like rgba(0,0,0,0) and "transparent").
        const isVisibleBg = (color: string) =>
          color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent";

        const parseRgb = (
          color: string,
        ): [number, number, number] | null => {
          const m = color.match(
            /rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/,
          );
          if (!m) return null;
          return [
            parseInt(m[1] ?? "0", 10),
            parseInt(m[2] ?? "0", 10),
            parseInt(m[3] ?? "0", 10),
          ];
        };

        const h1El = document.querySelector("h1");
        const h2El = document.querySelector("h2");
        const h3El = document.querySelector("h3");
        const linkEl =
          document.querySelector("main a") ??
          document.querySelector("article a") ??
          document.querySelector("a");
        const buttonEl =
          document.querySelector("button") ??
          document.querySelector('[role="button"]');

        // CTA selection: among the first ~80 anchors with a non-transparent
        // background, pick the one whose background is most CHROMATIC
        // (max channel minus min channel). Brand CTAs are colorful; ghost
        // and grayscale buttons (white-on-white, gray sign-in, dark-on-dark)
        // all have near-zero chroma and are rejected.
        let ctaEl: HTMLAnchorElement | null = null;
        let bestChroma = 30; // minimum chroma for a CTA to count as "brand"
        const anchors = Array.from(document.querySelectorAll("a")).slice(0, 80);
        for (const a of anchors) {
          const cs = getComputedStyle(a);
          if (!isVisibleBg(cs.backgroundColor)) continue;
          const rgb = parseRgb(cs.backgroundColor);
          if (!rgb) continue;
          const chroma =
            Math.max(rgb[0], rgb[1], rgb[2]) -
            Math.min(rgb[0], rgb[1], rgb[2]);
          if (chroma > bestChroma) {
            bestChroma = chroma;
            ctaEl = a as HTMLAnchorElement;
          }
        }

        const rootStyle = getComputedStyle(document.documentElement);
        const cssVars: Record<string, string> = {};
        for (let i = 0; i < rootStyle.length; i++) {
          const name = rootStyle.item(i);
          if (name.startsWith("--")) {
            cssVars[name] = rootStyle.getPropertyValue(name).trim();
          }
        }

        const themeMeta = document.querySelector(
          'meta[name="theme-color"]',
        ) as HTMLMetaElement | null;
        const descMeta = document.querySelector(
          'meta[name="description"]',
        ) as HTMLMetaElement | null;

        const iconLinks = Array.from(
          document.querySelectorAll('link[rel*="icon"]'),
        ) as HTMLLinkElement[];
        let favicon: HTMLLinkElement | null = null;
        let faviconSize = -1;
        for (const link of iconLinks) {
          const sizes = link.getAttribute("sizes") ?? "";
          const sizeNum = parseInt(sizes.split("x")[0] ?? "0", 10) || 0;
          if (sizeNum >= faviconSize) {
            faviconSize = sizeNum;
            favicon = link;
          }
        }

        return {
          title: document.title || "",
          description: descMeta?.content ?? "",
          themeColor: themeMeta?.content ?? "",
          faviconUrl: favicon?.href ?? "",
          cssVars,
          htmlBackgroundColor: htmlStyle.backgroundColor,
          body: {
            backgroundColor: bodyStyle.backgroundColor,
            color: bodyStyle.color,
            fontFamily: bodyStyle.fontFamily,
            fontSize: bodyStyle.fontSize,
            fontWeight: bodyStyle.fontWeight,
          },
          h1: computedH(h1El),
          h2: h2El ? { fontSize: getComputedStyle(h2El).fontSize } : null,
          h3: h3El ? { fontSize: getComputedStyle(h3El).fontSize } : null,
          link: linkEl ? { color: getComputedStyle(linkEl).color } : null,
          button: buttonEl
            ? {
                backgroundColor: getComputedStyle(buttonEl).backgroundColor,
                borderRadius: getComputedStyle(buttonEl).borderRadius,
                color: getComputedStyle(buttonEl).color,
              }
            : null,
          cta: ctaEl
            ? {
                backgroundColor: getComputedStyle(ctaEl).backgroundColor,
                color: getComputedStyle(ctaEl).color,
                borderRadius: getComputedStyle(ctaEl).borderRadius,
              }
            : null,
        };
      })) as Omit<ExtractedSignals, "url"> | null;

      if (!signals) {
        throw new Error("Page has no <body> — cannot extract signals");
      }

      const screenshotBuffer = await page.screenshot({
        type: "png",
        fullPage: false,
      });
      const screenshotDataUrl = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;

      const full: ExtractedSignals = { url: target.toString(), ...signals };
      const designSystemData = synthesizeDesignSystem(full);
      const markdown = designSystemToDesignMd({
        title: full.title || target.hostname,
        description: full.description,
        data: designSystemData,
      });

      return {
        url: target.toString(),
        designSystemData,
        markdown,
        signals: full,
        screenshotDataUrl,
      };
    } finally {
      await browser.close();
    }
  },
});
