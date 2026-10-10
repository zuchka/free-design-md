import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getDbExec, closeDbClient } from "../db/client.js";
import { closeAnalyticsDb, analyticsWrite } from "./analytics-db.js";
import {
  bootstrapVisitor,
  resolveAnalyticsActor,
  linkAnalyticsVisitor,
  visitorDigest,
} from "./analytics-identity.js";
import {
  recordGrowthEvent,
  recordClientGrowthEvent,
  withGrowthRequest,
  recordAiStarted,
  recordAiOutcome,
} from "./analytics.js";
import { getGrowthReport, reportOptions } from "./analytics-queries.js";
import {
  maintainAnalytics,
  projectPurchases,
} from "./analytics-maintenance.js";

const db = () => getDbExec();
const options = () =>
  reportOptions(
    new URL("http://localhost?start=2026-09-01&end=2026-10-01"),
    new Date("2026-10-10T12:00:00Z"),
  );
async function clear() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw new Error("Isolated local test database required");
  await db().execute(
    "TRUNCATE app.analytics_events,app.analytics_visitors,app.analytics_identities,app.analytics_link_intents,app.analytics_state",
  );
  await db().execute(
    "DELETE FROM app.purchases WHERE owner_id LIKE 'growth-test-%'",
  );
}
beforeEach(async () => {
  vi.stubEnv("GROWTH_ANALYTICS_ENABLED", "1");
  vi.stubEnv("GROWTH_ANALYTICS_REQUIRE_CONSENT", "0");
  vi.stubEnv("BETTER_AUTH_SECRET", "analytics-integration-test-secret");
  vi.stubEnv("FREE_DESIGN_MD_SELF_HOSTED", "0");
  await clear();
});
afterEach(async () => {
  await closeAnalyticsDb();
  await clear();
  await closeDbClient();
  vi.unstubAllEnvs();
});
function request(cookie?: string) {
  return new Request("http://localhost/api/analytics/events", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "sec-fetch-site": "same-origin",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      ...(cookie ? { cookie } : {}),
    },
  });
}
async function visitor() {
  const result = await bootstrapVisitor(request());
  expect(result.enabled).toBe(true);
  return request(result.cookie!.split(";")[0]);
}
async function identity(kind = "anonymous", first = "2026-09-01T12:00:00Z") {
  const id = randomUUID();
  await db().execute({
    sql: "INSERT INTO app.analytics_identities(id,kind,first_seen_at,first_active_at) VALUES ($1,$2,$3,$3)",
    args: [id, kind, first],
  });
  return id;
}
async function event(
  person: string | null,
  name: string,
  time: string,
  extras: { artifact?: string; source?: string; audience?: string } = {},
) {
  const id = randomUUID();
  await db().execute({
    sql: `INSERT INTO app.analytics_events(id,deduplication_key,identity_id,name,occurred_at,source,audience,trust,auth_state,artifact_id)
    VALUES ($1::uuid,$1::text,$2,$3,$4,$5,$6,'server','anonymous',$7)`,
    args: [
      id,
      person,
      name,
      time,
      extras.source || "browser",
      extras.audience || "product",
      extras.artifact || null,
    ],
  });
}
describe("growth analytics on Postgres", () => {
  it("keeps one anonymous identity across sessions, merges two browsers into an account, and rotates on sign-out", async () => {
    const first = await visitor(),
      second = await visitor();
    const a = await resolveAnalyticsActor(first),
      again = await resolveAnalyticsActor(first),
      b = await resolveAnalyticsActor(second);
    expect(a.identityId).toBeTruthy();
    expect(again.identityId).toBe(a.identityId);
    expect(b.identityId).not.toBe(a.identityId);
    const user = {
      id: "growth-test-account",
      emailVerified: true,
      isAnonymous: false,
    };
    await linkAnalyticsVisitor(first.headers, user);
    await linkAnalyticsVisitor(second.headers, user);
    const linkedA = await resolveAnalyticsActor(first, user),
      linkedB = await resolveAnalyticsActor(second, user);
    expect(linkedA.identityId).toBe(linkedB.identityId);
    await linkAnalyticsVisitor(first.headers, {
      ...user,
      id: "growth-test-other",
    });
    const canonical = (
      await db().execute({
        sql: "SELECT canonical_id FROM app.analytics_identities WHERE id=$1",
        args: [a.identityId!],
      })
    ).rows[0].canonical_id;
    expect(canonical).toBe(linkedA.identityId);
    expect((await resolveAnalyticsActor(first)).identityId).toBeNull();
    const rotated = await bootstrapVisitor(first);
    expect(rotated.cookie).not.toBe(first.headers.get("cookie"));
    expect(
      visitorDigest(new Headers({ cookie: rotated.cookie!.split(";")[0] })),
    ).not.toBe(visitorDigest(first.headers));
  });
  it("counts many extractions once and resolves historical aliases, excluding bots and API requests", async () => {
    const a = await identity(),
      account = await identity("account"),
      other = await identity();
    await db().execute({
      sql: "UPDATE app.analytics_identities SET canonical_id=$2 WHERE id=$1",
      args: [a, account],
    });
    for (let i = 0; i < 100; i++)
      await event(
        i % 2 ? a : account,
        "extraction_succeeded",
        `2026-09-${i % 2 ? "02" : "03"}T12:00:00Z`,
      );
    await event(other, "extraction_succeeded", "2026-09-01T12:00:00Z", {
      source: "api",
    });
    await event(other, "extraction_succeeded", "2026-09-01T12:00:00Z", {
      audience: "bot",
    });
    await event(null, "extraction_succeeded", "2026-09-01T12:00:00Z");
    const r = await getGrowthReport(options());
    expect(r.overview.active).toBe(1);
    expect(r.monthly[0].active).toBe(1);
    expect(r.daily.reduce((n, d) => n + d.active, 0)).toBe(2);
    expect(r.overview.verified).toBe(1);
  });
  it("reports ordered, artifact-matched funnels and mature retention", async () => {
    const a = await identity(),
      b = await identity("anonymous", "2026-09-03T12:00:00Z");
    for (const p of [a, b])
      await event(p, "page_viewed", "2026-09-01T10:00:00Z");
    await event(a, "extraction_succeeded", "2026-09-01T12:00:00Z", {
      artifact: "a",
    });
    await event(a, "artifact_downloaded", "2026-09-02T12:00:00Z", {
      artifact: "a",
    });
    await event(a, "extraction_succeeded", "2026-09-08T12:00:00Z");
    await event(a, "extraction_succeeded", "2026-10-02T12:00:00Z");
    await event(b, "artifact_downloaded", "2026-09-01T11:00:00Z", {
      artifact: "wrong",
    });
    await event(b, "extraction_succeeded", "2026-09-03T12:00:00Z", {
      artifact: "b",
    });
    const r = await getGrowthReport(options());
    expect(r.activation).toMatchObject({
      visitors: 2,
      extracted: 2,
      exported: 1,
      matureVisitors: 2,
      matureExported: 1,
      openVisitors: 0,
    });
    expect(r.retention.find((x) => x.period === "week")).toMatchObject({
      size: 2,
      retained: 1,
      mature: true,
    });
    expect(r.retention.find((x) => x.period === "month")).toMatchObject({
      size: 2,
      retained: 1,
      mature: false,
    });
  });
  it("records server events idempotently and refuses to qualify someone else's export", async () => {
    const req = await visitor(),
      actor = await resolveAnalyticsActor(req);
    const input = {
      name: "extraction_succeeded",
      key: "unique-extraction",
      artifactId: "my-artifact",
      durationMs: 12,
    };
    await Promise.all([
      recordGrowthEvent(input, actor),
      recordGrowthEvent(input, actor),
    ]);
    expect(
      Number(
        (
          await db().execute(
            "SELECT count(*) AS count FROM app.analytics_events",
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    await recordClientGrowthEvent(req, {
      id: randomUUID(),
      name: "artifact_downloaded",
      artifactId: "other-person",
      page: "workspace",
    });
    await recordClientGrowthEvent(req, {
      id: randomUUID(),
      name: "artifact_downloaded",
      artifactId: "my-artifact",
      page: "workspace",
    });
    const rows = (
      await db().execute(
        "SELECT audience FROM app.analytics_events WHERE name='artifact_downloaded' ORDER BY occurred_at",
      )
    ).rows;
    expect(rows.map((r) => r.audience)).toEqual(["unknown", "product"]);
  });
  it("returns zeros with explicit missing coverage and compares complete calendar months", async () => {
    const r = await getGrowthReport(options());
    expect(r.overview.active).toBe(0);
    expect(r.activation.visitors).toBe(0);
    expect(r.purchaseFunnel.activated).toBe(0);
    expect(r.collectionStartedAt).toBeNull();
    expect(r.overview.previousStart).toContain("2026-08-01");
    expect(r.overview.previousEnd).toContain("2026-09-01");
  });
  it("projects billing once and preserves actual amounts and currency", async () => {
    await db().execute({
      sql: `INSERT INTO app.purchases(id,owner_id,stripe_checkout_session_id,pack_id,credits,amount_total,currency,status,created_at,fulfilled_at)
      VALUES ($1,'growth-test-buyer','growth-test-session','ai-runs-10',10,349,'usd','fulfilled','2026-09-01 10:00:00','2026-09-02 10:00:00')`,
      args: [randomUUID()],
    });
    await projectPurchases(db());
    await projectPurchases(db());
    expect(
      Number(
        (
          await db().execute(
            "SELECT count(*) AS count FROM app.analytics_events WHERE name='purchase_fulfilled'",
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    expect(
      (await db().execute("SELECT * FROM app.analytics_identities")).rows,
    ).toHaveLength(0);
    const r = await getGrowthReport(options());
    expect(r.sales).toEqual([
      {
        currency: "usd",
        purchases: 1,
        purchasers: 1,
        firstTime: 1,
        repeat: 0,
        amountMinor: 349,
        missingAmounts: 0,
      },
    ]);
  });
  it("cleans old events and recovers links without the deleted anonymous auth row", async () => {
    const req = await visitor();
    const actor = await resolveAnalyticsActor(req);
    await db().execute({
      sql: "UPDATE app.analytics_visitors SET anonymous_user_id='old-anon' WHERE digest=$1",
      args: [visitorDigest(req.headers)!],
    });
    await db().execute(
      "INSERT INTO app.analytics_link_intents VALUES ('old-anon','growth-test-verified',now())",
    );
    await event(actor.identityId, "page_viewed", "2020-01-01T00:00:00Z");
    await maintainAnalytics(db());
    expect(
      Number(
        (
          await db().execute(
            "SELECT count(*) AS count FROM app.analytics_events",
          )
        ).rows[0].count,
      ),
    ).toBe(0);
    expect(
      (
        await db().execute({
          sql: "SELECT canonical_id FROM app.analytics_identities WHERE id=$1",
          args: [actor.identityId!],
        })
      ).rows[0].canonical_id,
    ).toBeTruthy();
  });
  it("keeps private analytics tables inaccessible to Supabase API roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      const result = await db().execute({
        sql: "SELECT has_table_privilege($1,'app.analytics_events','SELECT') AS allowed",
        args: [role],
      });
      expect(result.rows[0].allowed).toBe(false);
    }
    await db().transaction(async (tx) => {
      await tx.execute("SET LOCAL ROLE free_design_app");
      await tx.execute({
        sql: "INSERT INTO app.analytics_identities(id,kind) VALUES ($1,'anonymous')",
        args: [randomUUID()],
      });
      expect(
        (await tx.execute("SELECT * FROM app.analytics_identities")).rows,
      ).toHaveLength(1);
      await tx.execute("DELETE FROM app.analytics_identities");
    });
    const result = await db().execute(
      "SELECT has_table_privilege('free_design_app','app.analytics_events','INSERT') AS allowed",
    );
    expect(result.rows[0].allowed).toBe(true);
  });
  it("bounds failed database work and leaves unknown visitors uncounted", async () => {
    const started = Date.now();
    expect(
      await analyticsWrite(async (db) => {
        await db.execute("SELECT pg_sleep(2)");
        return true;
      }),
    ).toBeNull();
    expect(Date.now() - started).toBeLessThan(1200);
    expect((await resolveAnalyticsActor(request())).identityId).toBeNull();
  });
  it("measures acquisition and repeat purchase funnels against the same resolved identity", async () => {
    const a = await identity("account");
    await db().execute({
      sql: "UPDATE app.analytics_identities SET user_id='growth-test-funnel' WHERE id=$1",
      args: [a],
    });
    await db().execute({
      sql: `INSERT INTO app.analytics_visitors(digest,identity_id,attribution) VALUES ('test-digest',$1,'{"source":"newsletter"}')`,
      args: [a],
    });
    await event(a, "page_viewed", "2026-09-01T10:00:00Z");
    await event(a, "extraction_succeeded", "2026-09-01T12:00:00Z", {
      artifact: "wrong-first",
    });
    await event(a, "extraction_succeeded", "2026-09-02T12:00:00Z", {
      artifact: "second",
    });
    await event(a, "artifact_downloaded", "2026-09-03T12:00:00Z", {
      artifact: "second",
    });
    await event(a, "account_verified", "2026-09-02T13:00:00Z");
    await event(a, "extraction_succeeded", "2026-09-08T12:00:00Z");
    for (const day of [3, 4])
      await db().execute({
        sql: `INSERT INTO app.purchases(id,owner_id,stripe_checkout_session_id,pack_id,credits,amount_total,currency,status,created_at,fulfilled_at)
      VALUES ($1,'growth-test-funnel',$2,'ai-runs-10',10,349,'usd','fulfilled',$3,$3)`,
        args: [
          randomUUID(),
          `growth-test-funnel-${day}`,
          `2026-09-0${day} 14:00:00`,
        ],
      });
    const r = await getGrowthReport(options());
    expect(r.activation.exported).toBe(1);
    expect(r.purchaseFunnel).toMatchObject({
      activated: 1,
      verified: 1,
      purchased: 1,
      checkouts: 2,
      fulfilledCheckouts: 2,
      directPurchasers: 0,
    });
    expect(r.acquisition).toEqual([
      {
        channel: "newsletter",
        visitors: 1,
        active: 1,
        retentionEligible: 1,
        retained: 1,
        purchasers: 1,
      },
    ]);
    expect(r.sales[0]).toMatchObject({
      purchases: 2,
      purchasers: 1,
      firstTime: 1,
      repeat: 1,
      amountMinor: 698,
    });
  });
  it("compares partial January with equal elapsed December days, independently of session timezone", async () => {
    const opts = reportOptions(
      new URL("http://localhost?start=2026-01-01&end=2026-01-10"),
      new Date("2026-01-15T12:00:00Z"),
    );
    const r = await db().transaction(async (tx) => {
      await tx.execute("SET LOCAL TIME ZONE 'America/Los_Angeles'");
      return getGrowthReport(opts, tx);
    });
    expect(new Date(r.overview.previousStart).toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
    expect(new Date(r.overview.previousEnd).toISOString()).toBe(
      "2025-12-10T00:00:00.000Z",
    );
    expect(r.daily).toHaveLength(9);
  });
  it("excludes failed or refunded AI streams from creator success", async () => {
    const req = await visitor();
    await withGrowthRequest(req, async () => {
      await recordAiStarted("growth-test-failed-ai", "iterate");
      await recordAiOutcome({
        route: "iterate",
        status: "error",
        quota: "refunded",
        startedAt: Date.now() / 1000 - 1,
      });
    });
    const rows = (
      await db().execute(
        "SELECT name,duration_ms FROM app.analytics_events ORDER BY occurred_at",
      )
    ).rows;
    expect(rows.map((r) => r.name)).toEqual(["ai_started", "ai_failed"]);
    expect(Number(rows[1].duration_ms)).toBeGreaterThanOrEqual(1000);
    expect(
      (
        await db().execute(
          "SELECT first_active_at FROM app.analytics_identities",
        )
      ).rows[0].first_active_at,
    ).toBeNull();
  });
});
