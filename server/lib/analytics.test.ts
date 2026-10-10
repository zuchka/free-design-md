import { describe, expect, it, afterEach, vi } from "vitest";
import { clientEventSchema } from "../../shared/analytics.js";
import {
  reportOptions,
  growthReportCsv,
  type GrowthReport,
} from "./analytics-queries.js";
import {
  analyticsOrigin,
  bootstrapVisitor,
  sameOrigin,
  sanitizeAttribution,
  trackingAllowed,
  visitorDigest,
} from "./analytics-identity.js";
import { analyticsAdminUser } from "./analytics-admin.js";

afterEach(() => vi.unstubAllEnvs());
describe("growth analytics boundary rules", () => {
  it("uses the configured public origin behind a TLS-terminating proxy", async () => {
    vi.stubEnv("PUBLIC_ORIGIN", "https://free.design");
    vi.stubEnv("GROWTH_ANALYTICS_ENABLED", "0");
    const request = new Request("http://internal:8080/api/analytics/visitor", {
      headers: { origin: "https://free.design" },
    });
    expect(sameOrigin(request)).toBe(true);
    expect((await bootstrapVisitor(request)).cookie).toContain("; Secure");
    for (const headers of [
      { origin: "http://free.design" },
      {
        origin: "https://evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
      { origin: "https://free.design", "sec-fetch-site": "cross-site" },
      {},
    ]) {
      expect(sameOrigin(new Request(request.url, { headers }))).toBe(false);
    }
  });
  it("falls back to the auth origin or direct local URL without trusting forwarding headers", () => {
    vi.stubEnv("PUBLIC_ORIGIN", "");
    vi.stubEnv("BETTER_AUTH_URL", "https://free.design/api/auth");
    const request = new Request("http://localhost:8080/api/analytics/visitor", {
      headers: {
        origin: "http://localhost:8080",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    });
    expect(analyticsOrigin(request)).toBe("https://free.design");
    expect(sameOrigin(request)).toBe(false);
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(analyticsOrigin(request)).toBe("http://localhost:8080");
    expect(sameOrigin(request)).toBe(true);
  });
  it("only accepts browser-reportable events and no identity overrides", () => {
    const event = {
      id: crypto.randomUUID(),
      name: "page_viewed",
      page: "workspace",
    };
    expect(clientEventSchema.safeParse(event).success).toBe(true);
    expect(
      clientEventSchema.safeParse({ ...event, name: "purchase_fulfilled" })
        .success,
    ).toBe(false);
    expect(
      clientEventSchema.safeParse({ ...event, ownerId: "victim" }).success,
    ).toBe(false);
    expect(
      clientEventSchema.safeParse({
        ...event,
        artifactId: "https://secret/?token=x",
      }).success,
    ).toBe(false);
  });
  it("strips referrer paths, query strings, credentials and invalid campaign values", () => {
    expect(
      sanitizeAttribution(
        {
          referrer: "https://user:secret@search.example/path?token=secret",
          source: "newsletter",
          campaign: "x@example.com",
        },
        "https://free.design",
      ),
    ).toEqual({ referrer: "search.example", source: "newsletter" });
    expect(
      sanitizeAttribution(
        { referrer: "https://free.design/private" },
        "https://free.design",
      ),
    ).toEqual({});
  });
  it("honors feature flag, opt-out, browser signals, and explicit-consent mode", () => {
    vi.stubEnv("GROWTH_ANALYTICS_ENABLED", "1");
    expect(trackingAllowed(new Headers())).toBe(true);
    for (const headers of [
      { "sec-gpc": "1" },
      { dnt: "1" },
      { cookie: "fdmd_analytics_choice=off" },
    ])
      expect(trackingAllowed(new Headers(headers))).toBe(false);
    vi.stubEnv("GROWTH_ANALYTICS_REQUIRE_CONSENT", "1");
    expect(trackingAllowed(new Headers())).toBe(false);
    expect(
      trackingAllowed(new Headers({ cookie: "fdmd_analytics_choice=on" })),
    ).toBe(true);
    vi.stubEnv("FREE_DESIGN_MD_SELF_HOSTED", "1");
    expect(
      trackingAllowed(new Headers({ cookie: "fdmd_analytics_choice=on" })),
    ).toBe(false);
  });
  it("rejects unsigned visitor identifiers", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "analytics-unit-secret");
    expect(
      visitorDigest(
        new Headers({ cookie: "fdmd_visitor=someone-elses-id.invalid" }),
      ),
    ).toBeNull();
  });
  it("requires both verification and explicit admin allowlisting", () => {
    vi.stubEnv("GROWTH_ANALYTICS_ADMIN_EMAILS", "analytics-admin@example.com");
    const user = {
      id: "owner",
      email: "analytics-admin@example.com",
      emailVerified: true,
      isAnonymous: false,
    };
    expect(analyticsAdminUser(user)).toBe(true);
    expect(analyticsAdminUser({ ...user, emailVerified: false })).toBe(false);
    expect(analyticsAdminUser({ ...user, isAnonymous: true })).toBe(false);
    expect(analyticsAdminUser({ ...user, email: "other@example.com" })).toBe(
      false,
    );
    vi.stubEnv("GROWTH_ANALYTICS_ADMIN_EMAILS", "");
    vi.stubEnv("GROWTH_ANALYTICS_ADMIN_USER_IDS", "");
    expect(analyticsAdminUser(user)).toBe(false);
  });
  it("uses the last completed month by default and rejects impossible dates and large ranges", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    expect(reportOptions(new URL("https://example.com"), now)).toMatchObject({
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-10-01T00:00:00.000Z",
    });
    for (const query of [
      "start=2026-02-31",
      "start=2020-01-01",
      "identity=bogus",
      "start=2026-10-02&end=2026-10-01",
    ])
      expect(() =>
        reportOptions(new URL(`https://example.com?${query}`), now),
      ).toThrow();
  });
  it("escapes spreadsheet formulas in exported attribution", () => {
    const report = {
      options: { start: "2026-09-01" },
      overview: {},
      monthly: [],
      retention: [],
      daily: [],
      acquisition: [{ channel: '=HYPERLINK("evil")' }],
      sales: [],
      coverage: [],
      performance: [],
      activation: {},
      purchaseFunnel: {},
    } as unknown as GrowthReport;
    expect(growthReportCsv(report)).toContain("'=HYPERLINK");
  });
});
