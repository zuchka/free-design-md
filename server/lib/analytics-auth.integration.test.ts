import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDbExec, closeDbClient } from "../db/client.js";
import { closeAnalyticsDb } from "./analytics-db.js";
import {
  bootstrapVisitor,
  resolveAnalyticsActor,
  visitorDigest,
} from "./analytics-identity.js";

const origin = "http://localhost:8080";
const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36";
let ownerIds: string[] = [];
beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL || "");
  if (url.hostname !== "127.0.0.1" || !url.pathname.endsWith("_test"))
    throw Error("Local test database required");
  vi.stubEnv("BETTER_AUTH_SECRET", "analytics-auth-integration-secret");
  vi.stubEnv("GROWTH_ANALYTICS_ENABLED", "1");
  vi.stubEnv("GROWTH_ANALYTICS_REQUIRE_CONSENT", "0");
  vi.stubEnv("RESEND_API_KEY", "test-key-not-a-credential");
  vi.stubEnv("GROWTH_ANALYTICS_ADMIN_EMAILS", "analytics-admin@example.com");
  await getDbExec().execute(
    "TRUNCATE app.analytics_events,app.analytics_visitors,app.analytics_identities,app.analytics_link_intents,app.analytics_state",
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await closeAnalyticsDb();
  await getDbExec().execute(
    "TRUNCATE app.analytics_events,app.analytics_visitors,app.analytics_identities,app.analytics_link_intents,app.analytics_state",
  );
  for (const id of ownerIds) {
    await getDbExec().execute({
      sql: "DELETE FROM app.credit_wallets WHERE owner_id=$1",
      args: [id],
    });
    await getDbExec().execute({
      sql: "DELETE FROM app.auth_users WHERE id=$1",
      args: [id],
    });
  }
  ownerIds = [];
  await closeDbClient();
});
function req(path: string, cookie = "", body?: unknown) {
  return new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "user-agent": userAgent,
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

describe("analytics across real Better Auth and HTTP boundaries", () => {
  it("bootstraps and retains a Secure visitor through an internal HTTP proxy URL", async () => {
    vi.stubEnv("PUBLIC_ORIGIN", "https://free.design");
    const { readAnalyticsBody } = await import("./analytics-http.js");
    const request = (cookie = "") =>
      new Request("http://internal:8080/api/analytics/visitor", {
        method: "POST",
        headers: {
          origin: "https://free.design",
          "content-type": "application/json",
          "user-agent": userAgent,
          cookie,
        },
        body: "{}",
      });
    const firstRequest = request();
    const first = await bootstrapVisitor(
      firstRequest,
      null,
      await readAnalyticsBody(firstRequest),
    );
    expect(first.enabled).toBe(true);
    expect(first.cookie).toContain("; Secure");
    const cookie = first.cookie!.split(";")[0];
    const secondRequest = request(cookie);
    const second = await bootstrapVisitor(
      secondRequest,
      null,
      await readAnalyticsBody(secondRequest),
    );
    expect(second.enabled).toBe(true);
    expect(second.cookie!.split(";")[0]).toBe(cookie);
    expect(
      (await getDbExec().execute("SELECT id FROM app.analytics_identities"))
        .rows,
    ).toHaveLength(1);
  });
  it("links a real anonymous magic-link session, protects admin reports, and clears tracking on sign-out", async () => {
    const { auth } = await import("./auth.js");
    const { requireAnalyticsAdmin } = await import("./analytics-admin.js");
    const anonResponse = await auth.handler(
      req("/api/auth/sign-in/anonymous", "", {}),
    );
    expect(anonResponse.status).toBe(200);
    const anon = await anonResponse.json();
    ownerIds.push(anon.user.id);
    const authCookie = cookies(anonResponse);
    const visitor = await bootstrapVisitor(
      req("/api/analytics/visitor", authCookie, {}),
      anon.user,
    );
    expect(visitor.enabled).toBe(true);
    const cookie = authCookie + "; " + visitor.cookie!.split(";")[0];
    const originalActor = await resolveAnalyticsActor(req("/", cookie));
    expect(originalActor.identityId).toBeTruthy();
    let magicUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      expect(String(input)).toBe("https://api.resend.com/emails");
      magicUrl = JSON.parse(init!.body as string).html.match(
        /href="([^"]+)"/,
      )[1];
      return Response.json({ id: "test" });
    });
    const response = await auth.handler(
      req("/api/auth/sign-in/magic-link", cookie, {
        email: `growth-auth-${randomUUID()}@example.com`,
        callbackURL: "/",
      }),
    );
    expect(response.ok).toBe(true);
    expect(magicUrl).toBeTruthy();
    const verified = await auth.handler(
      new Request(magicUrl, { headers: req("/", cookie).headers }),
    );
    expect(verified.status).toBe(302);
    const verifiedCookie =
      cookies(verified) + "; " + visitor.cookie!.split(";")[0];
    const session = await auth.api.getSession({
      headers: req("/", verifiedCookie).headers,
    });
    expect(session?.user.emailVerified).toBe(true);
    ownerIds.push(session!.user.id);
    const rows = await getDbExec().execute({
      sql: "SELECT i.canonical_id,c.user_id FROM app.analytics_identities i JOIN app.analytics_identities c ON c.id=i.canonical_id WHERE i.id=$1",
      args: [originalActor.identityId!],
    });
    expect(rows.rows[0].user_id).toBe(session!.user.id);
    expect(
      (
        await getDbExec().execute(
          "SELECT name FROM app.analytics_events WHERE name='account_verified'",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      requireAnalyticsAdmin(req("/admin/analytics", verifiedCookie)),
    ).rejects.toMatchObject({ status: 403 });
    vi.stubEnv("GROWTH_ANALYTICS_ADMIN_USER_IDS", session!.user.id);
    await expect(
      requireAnalyticsAdmin(req("/admin/analytics", verifiedCookie)),
    ).resolves.toBeUndefined();
    await expect(
      requireAnalyticsAdmin(req("/api/admin/analytics")),
    ).rejects.toMatchObject({ status: 403 });
    const { action } = await import("../../app/routes/api.auth.$.js");
    const signedOut = await action({
      request: req("/api/auth/sign-out", verifiedCookie, {}),
      params: {},
      context: {},
    } as never);
    expect(signedOut.ok).toBe(true);
    expect(
      signedOut.headers
        .getSetCookie()
        .some((c) => c.startsWith("fdmd_visitor=;") && c.includes("Max-Age=0")),
    ).toBe(true);
    expect(visitorDigest(req("/").headers)).toBeNull();
  });
  it("rejects cross-origin, oversized and privileged client events, and respects opt-out", async () => {
    const { action } = await import("../../app/routes/api.analytics.events.js");
    const call = (request: Request) =>
      action({ request, params: {}, context: {} } as never);
    const event = { id: randomUUID(), name: "page_viewed", page: "workspace" };
    await expect(
      call(
        new Request(origin + "/api/analytics/events", {
          method: "POST",
          headers: { origin: "https://evil.example" },
          body: JSON.stringify(event),
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      call(
        req("/api/analytics/events", "", { ...event, extra: "x".repeat(5000) }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(
      (
        await call(
          req("/api/analytics/events", "", {
            ...event,
            name: "purchase_fulfilled",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          req("/api/analytics/events", "fdmd_analytics_choice=off", event),
        )
      ).status,
    ).toBe(204);
    expect(
      (await getDbExec().execute("SELECT * FROM app.analytics_events")).rows,
    ).toHaveLength(0);
  });
});
