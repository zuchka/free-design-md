import { defineAction } from "@agent-native/core";
import { z } from "zod";
import { chromium, type Page } from "playwright";
import { designSystemToDesignMd } from "../shared/design-md.js";
import {
  synthesizeDesignSystem,
  type ExtractedSignals,
} from "../shared/extract-design-system.js";
import { recordActionRun } from "../server/lib/metrics.js";

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

type ConsentIntent = "decline" | "accept";

interface ConsentButtonCandidate {
  cmp: string;
  intent: ConsentIntent;
  selector?: string;
  name?: RegExp;
  requiresConsentContext?: boolean;
}

export const CONSENT_OVERLAY_SELECTORS = [
  // OneTrust
  "#onetrust-banner-sdk",
  "#onetrust-consent-sdk",
  ".onetrust-pc-dark-filter",
  // Cookiebot
  "#CybotCookiebotDialog",
  "#CookiebotWidget",
  // TrustArc
  "#truste-consent-track",
  "#truste-consent-content",
  ".truste_box_overlay",
  // Didomi
  "#didomi-host",
  ".didomi-popup-container",
  // Quantcast Choice
  ".qc-cmp2-container",
  ".qc-cmp2-consent-info",
  ".qc-cmp-cleanslate",
] as const;

export const CONSENT_DISMISSAL_CANDIDATES: ConsentButtonCandidate[] = [
  // Privacy-preserving controls first.
  {
    cmp: "onetrust",
    intent: "decline",
    selector: "#onetrust-reject-all-handler",
  },
  {
    cmp: "cookiebot",
    intent: "decline",
    selector: "#CybotCookiebotDialogBodyButtonDecline",
  },
  {
    cmp: "cookiebot",
    intent: "decline",
    selector: "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
  },
  {
    cmp: "trustarc",
    intent: "decline",
    selector: "#truste-consent-required",
  },
  {
    cmp: "didomi",
    intent: "decline",
    selector: "#didomi-notice-disagree-button",
  },
  {
    cmp: "didomi",
    intent: "decline",
    selector: ".didomi-components-button--disagree",
  },
  {
    cmp: "quantcast",
    intent: "decline",
    name: /^(reject|decline|deny)( all)?$/i,
    requiresConsentContext: true,
  },
  {
    cmp: "generic",
    intent: "decline",
    name: /^(reject|decline|deny)( all)?( optional cookies)?$/i,
    requiresConsentContext: true,
  },
  {
    cmp: "generic",
    intent: "decline",
    name: /^(only necessary|necessary only|essential only|strictly necessary)$/i,
    requiresConsentContext: true,
  },
  // Fallback: accept only when no decline/necessary-only option is visible.
  {
    cmp: "onetrust",
    intent: "accept",
    selector: "#onetrust-accept-btn-handler",
  },
  {
    cmp: "cookiebot",
    intent: "accept",
    selector: "#CybotCookiebotDialogBodyButtonAccept",
  },
  {
    cmp: "cookiebot",
    intent: "accept",
    selector: "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  },
  {
    cmp: "trustarc",
    intent: "accept",
    selector: "#truste-consent-button",
  },
  {
    cmp: "didomi",
    intent: "accept",
    selector: "#didomi-notice-agree-button",
  },
  {
    cmp: "didomi",
    intent: "accept",
    selector: ".didomi-components-button--agree",
  },
  {
    cmp: "quantcast",
    intent: "accept",
    name: /^accept( all)?$/i,
    requiresConsentContext: true,
  },
  {
    cmp: "generic",
    intent: "accept",
    name: /^accept( all)?( optional cookies| cookies)?$/i,
    requiresConsentContext: true,
  },
];

export interface ConsentDismissalResult {
  attempted: boolean;
  dismissed: boolean;
  cmp?: string;
  intent?: ConsentIntent;
  selector?: string;
  name?: string;
}

async function locatorHasConsentContext(
  locator: ReturnType<Page["locator"]>,
): Promise<boolean> {
  return locator
    .evaluate((el) => {
      let current: Element | null = el;
      for (let depth = 0; current && depth < 6; depth++) {
        const text = (current.textContent ?? "").replace(/\s+/g, " ");
        const className =
          typeof current.className === "string" ? current.className : "";
        const haystack = [
          current.id,
          className,
          current.getAttribute("aria-label") ?? "",
          current.getAttribute("role") ?? "",
          text,
        ]
          .join(" ")
          .toLowerCase();
        if (
          /cookie|consent|privacy|preferences|onetrust|cookiebot|trustarc|didomi|quantcast|qc-cmp/.test(
            haystack,
          )
        ) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    })
    .catch(() => false);
}

async function knownConsentOverlayVisible(page: Page): Promise<boolean> {
  for (const selector of CONSENT_OVERLAY_SELECTORS) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) === 0) continue;
    if (await locator.isVisible().catch(() => false)) return true;
  }
  return false;
}

async function waitForConsentOverlaysToSettle(page: Page): Promise<boolean> {
  await page.waitForTimeout(250);
  await Promise.all(
    CONSENT_OVERLAY_SELECTORS.map((selector) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: "hidden", timeout: 2_000 })
        .catch(() => undefined),
    ),
  );
  return !(await knownConsentOverlayVisible(page));
}

async function tryClickConsentCandidate(
  page: Page,
  candidate: ConsentButtonCandidate,
): Promise<ConsentDismissalResult | null> {
  const locator = candidate.selector
    ? page.locator(candidate.selector).first()
    : page.getByRole("button", { name: candidate.name }).first();

  if ((await locator.count().catch(() => 0)) === 0) return null;
  if (!(await locator.isVisible().catch(() => false))) return null;

  if (
    candidate.requiresConsentContext &&
    !(await locatorHasConsentContext(locator))
  ) {
    return null;
  }

  await locator.click({ timeout: 1_500 });
  const dismissed = await waitForConsentOverlaysToSettle(page);
  return {
    attempted: true,
    dismissed,
    cmp: candidate.cmp,
    intent: candidate.intent,
    selector: candidate.selector,
    name: candidate.name?.source,
  };
}

export async function dismissConsent(
  page: Page,
): Promise<ConsentDismissalResult> {
  for (const candidate of CONSENT_DISMISSAL_CANDIDATES) {
    const result = await tryClickConsentCandidate(page, candidate).catch(
      () => null,
    );
    if (result) return result;
  }

  return {
    attempted: false,
    dismissed: !(await knownConsentOverlayVisible(page)),
  };
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
    try {
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
          waitUntil: "load",
          timeout: 15_000,
        });
        // SPAs (Next.js, React, etc.) hydrate after `load` fires, adding and
        // re-rendering DOM nodes for a few seconds. Wait for the network to go
        // quiet so the DOM we evaluate is stable across runs. Some sites poll
        // analytics endpoints forever and never reach networkidle — that's
        // fine, we accept the timeout and proceed.
        try {
          await page.waitForLoadState("networkidle", { timeout: 5_000 });
        } catch {
          /* networkidle never reached — proceed with the load-state DOM */
        }

        await dismissConsent(page);

        const signals = (await page.evaluate(() => {
          const body = document.body;
          if (!body) {
            return null;
          }
          const bodyStyle = getComputedStyle(body);
          const htmlStyle = getComputedStyle(document.documentElement);

          // A "non-transparent" bg means the element is visually filled
          // (rules out untouched defaults like rgba(0,0,0,0) and "transparent").
          const isVisibleBg = (color: string) =>
            color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent";

          const parseRgb = (color: string): [number, number, number] | null => {
            const m = color.match(/rgba?\(\s*(\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/);
            if (!m) return null;
            return [
              parseInt(m[1] ?? "0", 10),
              parseInt(m[2] ?? "0", 10),
              parseInt(m[3] ?? "0", 10),
            ];
          };

          const parsePx = (v: string): number => {
            const m = v.match(/^(-?\d+(?:\.\d+)?)px/);
            return m && m[1] !== undefined ? parseFloat(m[1]) : 0;
          };

          const h1El = document.querySelector("h1");
          const h2El = document.querySelector("h2");
          const h3El = document.querySelector("h3");
          const linkEl =
            document.querySelector("main a") ??
            document.querySelector("article a") ??
            document.querySelector("a");

          // Location-aware ranking: prefer interactive elements inside <main>/
          // <header> over <footer>/<aside>. Otherwise unknown context.
          // (Note: `closest` returns the nearest matching ancestor, so a button
          // nested inside a footer-inside-main still scores as footer.)
          const locScore = (el: Element): number => {
            if (el.closest("footer, aside")) return 0;
            if (el.closest("main, header")) return 2;
            return 1;
          };

          // Lexicographic comparison on a sort key. Returns true if `a` ranks
          // strictly higher than `b`. Used to keep the "best so far" element
          // across multiple sort dimensions without sorting an array.
          const tupleGt = (a: number[], b: number[]): boolean => {
            for (let i = 0; i < a.length; i++) {
              const av = a[i] ?? 0;
              const bv = b[i] ?? 0;
              if (av !== bv) return av > bv;
            }
            return false;
          };

          // CTA-shape predicate: a text-bearing CTA button is wider than tall
          // (aspect >= 1.3) AND has either a visible background or a visible
          // border. Icon buttons (theme toggle, avatar dropdown, hamburger)
          // are roughly square (aspect ~ 1) and often transparent — those fail
          // this test and we prefer to pick a real CTA over them. If no button
          // on the page passes the test, we fall back to plain location-order
          // ranking so we still capture *something*.
          const isCtaShaped = (el: Element): boolean => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            if (rect.width / rect.height < 1.3) return false;
            const cs = getComputedStyle(el);
            if (isVisibleBg(cs.backgroundColor)) return true;
            if (parsePx(cs.borderTopWidth) > 0) return true;
            return false;
          };

          // Representative button: prefer CTA-shaped buttons (text-bearing,
          // wider than tall, with a visible bg or border) over icon buttons.
          // Within CTA-shaped buttons, prefer main/header over footer/aside,
          // then document order. The radius and color of this button feeds
          // the synthesizer's borderRadius fallback, so picking the hero CTA
          // over a circular icon button matters for design fidelity.
          let buttonEl: HTMLElement | null = null;
          let bestButtonKey: number[] = [-1, -1, Number.MIN_SAFE_INTEGER];
          const allButtons = Array.from(
            document.querySelectorAll("button"),
          ).slice(0, 80);
          allButtons.forEach((b, i) => {
            const ctaShape = isCtaShaped(b) ? 1 : 0;
            const key = [ctaShape, locScore(b), -i];
            if (tupleGt(key, bestButtonKey)) {
              bestButtonKey = key;
              buttonEl = b as HTMLElement;
            }
          });
          if (!buttonEl) {
            buttonEl = document.querySelector(
              '[role="button"]',
            ) as HTMLElement | null;
          }

          // CTA selection: among the first ~80 anchors with a non-transparent
          // background, pick the one whose background is most CHROMATIC
          // (max channel minus min channel). Brand CTAs are colorful; ghost
          // and grayscale buttons (white-on-white, gray sign-in, dark-on-dark)
          // all have near-zero chroma and are rejected. Among tied-chroma
          // anchors (same brand color used multiple places), break ties by
          // location score, then above-the-fold, then document order.
          let ctaEl: HTMLAnchorElement | null = null;
          let bestCtaKey: number[] = [
            30, // chroma must strictly exceed 30 to qualify
            -1,
            -1,
            Number.MIN_SAFE_INTEGER,
          ];
          const anchors = Array.from(document.querySelectorAll("a")).slice(
            0,
            80,
          );
          anchors.forEach((a, i) => {
            const cs = getComputedStyle(a);
            if (!isVisibleBg(cs.backgroundColor)) return;
            const rgb = parseRgb(cs.backgroundColor);
            if (!rgb) return;
            const chroma =
              Math.max(rgb[0], rgb[1], rgb[2]) -
              Math.min(rgb[0], rgb[1], rgb[2]);
            if (chroma <= 30) return;
            const rect = (a as HTMLElement).getBoundingClientRect();
            const aboveFold = rect.top >= 0 && rect.top < 800 ? 1 : 0;
            const key = [chroma, locScore(a), aboveFold, -i];
            if (tupleGt(key, bestCtaKey)) {
              bestCtaKey = key;
              ctaEl = a as HTMLAnchorElement;
            }
          });

          // Card-shape sample: find an element that LOOKS like a card so the
          // synthesizer can capture a card-specific border-radius separate from
          // the button radius. A "card" here is a small-to-medium element
          // with padding, a non-zero radius, and a border/shadow/distinct-bg.
          // Heroes and full-width sections rarely have non-zero corner radius,
          // so the radius filter handles those. Size constraints exclude tiny
          // chips/badges and full-page wrappers.
          const isCardLike = (el: Element): boolean => {
            const tag = el.tagName;
            if (tag === "A" || tag === "BUTTON") return false;
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.width < 80 || rect.width > 800) return false;
            if (rect.height < 40 || rect.height > 700) return false;
            const cs = getComputedStyle(el);
            const padTop = parsePx(cs.paddingTop);
            const padBottom = parsePx(cs.paddingBottom);
            if (padTop < 4 || padBottom < 4) return false;
            const radius = parsePx(cs.borderTopLeftRadius);
            if (radius <= 0) return false;
            const borderWidth = parsePx(cs.borderTopWidth);
            const hasBorder = borderWidth > 0;
            const hasShadow = cs.boxShadow && cs.boxShadow !== "none";
            const hasDistinctBg =
              isVisibleBg(cs.backgroundColor) &&
              cs.backgroundColor !== bodyStyle.backgroundColor;
            return hasBorder || !!hasShadow || hasDistinctBg;
          };

          let cardEl: Element | null = null;
          let bestCardKey: number[] = [-1, -1, Number.MIN_SAFE_INTEGER];
          const cardCandidates = Array.from(
            document.querySelectorAll("div, section, article, aside, li"),
          ).slice(0, 1200);
          cardCandidates.forEach((el, i) => {
            if (!isCardLike(el)) return;
            const rect = (el as HTMLElement).getBoundingClientRect();
            const aboveFold = rect.top >= 0 && rect.top < 800 ? 1 : 0;
            const key = [locScore(el), aboveFold, -i];
            if (tupleGt(key, bestCardKey)) {
              bestCardKey = key;
              cardEl = el;
            }
          });

          // Pill-radius detection: if ANY element on the page has a fully-
          // rounded radius (radius >= half its shorter dimension, or a literal
          // pill-marker value like 9999px), record its computed radius. This
          // is a presence signal — "does this brand use pills?" — not a token
          // that must be applied. First match wins; scan short-circuits.
          let pillRadius = "";
          const allEls = Array.from(document.querySelectorAll("*")).slice(
            0,
            400,
          );
          for (const el of allEls) {
            const cs = getComputedStyle(el);
            const r = parsePx(cs.borderTopLeftRadius);
            if (r <= 0) continue;
            if (r >= 9999) {
              pillRadius = cs.borderTopLeftRadius;
              break;
            }
            const rect = (el as HTMLElement).getBoundingClientRect();
            const shorter = Math.min(rect.width, rect.height);
            if (shorter <= 0) continue;
            // Tolerate a small float gap; pill if radius reaches at least half
            // the shorter dimension.
            if (r >= shorter / 2 - 0.5) {
              pillRadius = cs.borderTopLeftRadius;
              break;
            }
          }

          // Spacing-scale histogram: scan every element's computed padding*
          // and *gap, count occurrences of each plausible px value. The
          // synthesizer in Node-land filters/sorts/picks the top N — here
          // we just count, so the cross-bridge payload stays tiny.
          const paddingHistogram: Record<string, number> = {};
          const allEs = Array.from(document.querySelectorAll("*")).slice(
            0,
            2000,
          );
          const SPACING_PROPS = [
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "rowGap",
            "columnGap",
          ] as const;
          for (const el of allEs) {
            const cs = getComputedStyle(el);
            for (const prop of SPACING_PROPS) {
              const raw = (cs as unknown as Record<string, string>)[prop] ?? "";
              // Only accept plain Npx; reject auto, percentages, calc, etc.
              const m = raw.match(/^(\d+(?:\.\d+)?)px$/);
              if (!m || m[1] === undefined) continue;
              const n = parseFloat(m[1]);
              if (!(n >= 4 && n <= 256)) continue;
              paddingHistogram[raw] = (paddingHistogram[raw] ?? 0) + 1;
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
            h1: h1El
              ? (() => {
                  const cs = getComputedStyle(h1El);
                  return {
                    fontFamily: cs.fontFamily,
                    fontSize: cs.fontSize,
                    fontWeight: cs.fontWeight,
                    color: cs.color,
                    lineHeight: cs.lineHeight,
                    letterSpacing: cs.letterSpacing,
                  };
                })()
              : null,
            h2: h2El
              ? (() => {
                  const cs = getComputedStyle(h2El);
                  return {
                    fontSize: cs.fontSize,
                    lineHeight: cs.lineHeight,
                    letterSpacing: cs.letterSpacing,
                    color: cs.color,
                  };
                })()
              : null,
            h3: h3El
              ? (() => {
                  const cs = getComputedStyle(h3El);
                  return {
                    fontSize: cs.fontSize,
                    lineHeight: cs.lineHeight,
                    letterSpacing: cs.letterSpacing,
                    color: cs.color,
                  };
                })()
              : null,
            link: linkEl
              ? (() => {
                  const cs = getComputedStyle(linkEl);
                  return {
                    color: cs.color,
                    textDecorationLine: cs.textDecorationLine,
                    fontWeight: cs.fontWeight,
                  };
                })()
              : null,
            button: buttonEl
              ? (() => {
                  const cs = getComputedStyle(buttonEl as Element);
                  return {
                    backgroundColor: cs.backgroundColor,
                    borderRadius: cs.borderRadius,
                    color: cs.color,
                    padding: cs.padding,
                    fontSize: cs.fontSize,
                    fontWeight: cs.fontWeight,
                    borderTopWidth: cs.borderTopWidth,
                    borderTopStyle: cs.borderTopStyle,
                    borderTopColor: cs.borderTopColor,
                  };
                })()
              : null,
            cta: ctaEl
              ? (() => {
                  const cs = getComputedStyle(ctaEl as Element);
                  return {
                    backgroundColor: cs.backgroundColor,
                    color: cs.color,
                    borderRadius: cs.borderRadius,
                    padding: cs.padding,
                    fontSize: cs.fontSize,
                    fontWeight: cs.fontWeight,
                    borderTopWidth: cs.borderTopWidth,
                    borderTopStyle: cs.borderTopStyle,
                    borderTopColor: cs.borderTopColor,
                  };
                })()
              : null,
            cardSample: cardEl
              ? (() => {
                  const cs = getComputedStyle(cardEl as Element);
                  return {
                    borderRadius: cs.borderRadius,
                    padding: cs.padding,
                    backgroundColor: cs.backgroundColor,
                    color: cs.color,
                    borderTopWidth: cs.borderTopWidth,
                    borderTopStyle: cs.borderTopStyle,
                    borderTopColor: cs.borderTopColor,
                    boxShadow: cs.boxShadow,
                  };
                })()
              : null,
            pillRadius,
            paddingHistogram,
          };
        })) as Omit<ExtractedSignals, "url"> | null;

        if (!signals) {
          throw new Error("Page has no <body> — cannot extract signals");
        }

        // Anthropic's vision API rejects images whose long edge exceeds
        // 8000px (Stripe and other long marketing pages routinely hit this).
        // Cap the screenshot height at 7500px via clip — keeps the top
        // 7500px of the page intact and trims only the long tail.
        const SCREENSHOT_MAX_HEIGHT = 7500;
        const pageHeight = await page.evaluate(
          () => document.documentElement.scrollHeight,
        );
        const clipHeight = Math.min(pageHeight, SCREENSHOT_MAX_HEIGHT);
        const screenshotBuffer = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: 1280, height: clipHeight },
        });
        const screenshotDataUrl = `data:image/png;base64,${screenshotBuffer.toString("base64")}`;

        const full: ExtractedSignals = { url: target.toString(), ...signals };
        const designSystemData = synthesizeDesignSystem(full);
        const markdown = designSystemToDesignMd({
          title: full.title || target.hostname,
          description: full.description,
          data: designSystemData,
        });

        const result = {
          url: target.toString(),
          designSystemData,
          markdown,
          signals: full,
          screenshotDataUrl,
        };
        await recordActionRun({
          action: "extract-design-md",
          status: "success",
        });
        return result;
      } finally {
        await browser.close();
      }
    } catch (err) {
      await recordActionRun({ action: "extract-design-md", status: "error" });
      throw err;
    }
  },
});
