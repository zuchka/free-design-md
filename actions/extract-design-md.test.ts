import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import {
  CONSENT_DISMISSAL_CANDIDATES,
  CONSENT_OVERLAY_SELECTORS,
  dismissConsent,
} from "./extract-design-md";

let browser: Browser;
let page: Page;

describe("dismissConsent", () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("prefers privacy-preserving OneTrust decline over accept", async () => {
    await page.setContent(`
      <main>
        <button id="brand-cta">Start trial</button>
      </main>
      <div id="onetrust-consent-sdk">
        <div class="onetrust-pc-dark-filter"></div>
        <section id="onetrust-banner-sdk">
          <p>Here is how we use cookies.</p>
          <button
            id="onetrust-accept-btn-handler"
            onclick="window.clickedConsent='accept'; document.getElementById('onetrust-consent-sdk').remove()"
          >
            Accept all optional cookies
          </button>
          <button
            id="onetrust-reject-all-handler"
            onclick="window.clickedConsent='decline'; document.getElementById('onetrust-consent-sdk').remove()"
          >
            Decline all optional cookies
          </button>
        </section>
      </div>
    `);

    const result = await dismissConsent(page);

    expect(result).toMatchObject({
      attempted: true,
      dismissed: true,
      cmp: "onetrust",
      intent: "decline",
      selector: "#onetrust-reject-all-handler",
    });
    expect(
      await page.evaluate(
        () => (window as Window & { clickedConsent?: string }).clickedConsent,
      ),
    ).toBe("decline");
    expect(await page.locator("#onetrust-banner-sdk").count()).toBe(0);
  });

  it("falls back to accept when a Didomi notice has no decline control", async () => {
    await page.setContent(`
      <main>
        <button id="brand-cta">Contact sales</button>
      </main>
      <div id="didomi-host">
        <div class="didomi-popup-container">
          <p>We use cookies for analytics and personalization.</p>
          <button
            id="didomi-notice-agree-button"
            onclick="window.clickedConsent='accept'; document.getElementById('didomi-host').remove()"
          >
            Accept all
          </button>
        </div>
      </div>
    `);

    const result = await dismissConsent(page);

    expect(result).toMatchObject({
      attempted: true,
      dismissed: true,
      cmp: "didomi",
      intent: "accept",
      selector: "#didomi-notice-agree-button",
    });
    expect(
      await page.evaluate(
        () => (window as Window & { clickedConsent?: string }).clickedConsent,
      ),
    ).toBe("accept");
    expect(await page.locator("#didomi-host").count()).toBe(0);
  });

  it("does not click generic accept text outside a consent context", async () => {
    await page.setContent(`
      <main>
        <h1>Plan review</h1>
        <button onclick="window.clickedConsent='ordinary'">Accept all</button>
      </main>
    `);

    const result = await dismissConsent(page);

    expect(result).toEqual({ attempted: false, dismissed: true });
    expect(
      await page.evaluate(
        () => (window as Window & { clickedConsent?: string }).clickedConsent,
      ),
    ).toBeUndefined();
  });

  it("covers the common CMP families with selectors or guarded text buttons", () => {
    const candidateCmps = new Set(
      CONSENT_DISMISSAL_CANDIDATES.map((candidate) => candidate.cmp),
    );
    const overlaySelectorText = CONSENT_OVERLAY_SELECTORS.join(" ");

    expect(Array.from(candidateCmps)).toEqual(
      expect.arrayContaining([
        "onetrust",
        "cookiebot",
        "trustarc",
        "didomi",
        "quantcast",
      ]),
    );
    expect(overlaySelectorText).toContain("onetrust");
    expect(overlaySelectorText).toContain("Cookiebot");
    expect(overlaySelectorText).toContain("truste");
    expect(overlaySelectorText).toContain("didomi");
    expect(overlaySelectorText).toContain("qc-cmp");

    for (const cmp of [
      "onetrust",
      "cookiebot",
      "trustarc",
      "didomi",
      "quantcast",
    ]) {
      const intents = new Set(
        CONSENT_DISMISSAL_CANDIDATES.filter(
          (candidate) => candidate.cmp === cmp,
        ).map((candidate) => candidate.intent),
      );
      expect(intents.has("decline")).toBe(true);
      expect(intents.has("accept")).toBe(true);
    }
  });
});
