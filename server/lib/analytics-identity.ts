import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { isbot } from "isbot";
import type { DbExecutor } from "../db/client.js";
import { analyticsEnabled, analyticsWrite } from "./analytics-db.js";
import {
  attributionSchema,
  type AnalyticsAudience,
  type AnalyticsSource,
} from "../../shared/analytics.js";

export const VISITOR_COOKIE = "fdmd_visitor";
export interface AnalyticsUser {
  id: string;
  emailVerified?: boolean;
  isAnonymous?: boolean | null;
}
export interface AnalyticsActor {
  identityId: string | null;
  userId?: string;
  source: AnalyticsSource;
  audience: AnalyticsAudience;
  authState: "anonymous" | "verified" | "unknown";
}
const unknownActor: AnalyticsActor = {
  identityId: null,
  source: "api",
  audience: "unknown",
  authState: "unknown",
};
function secret() {
  return (
    process.env.GROWTH_ANALYTICS_COOKIE_SECRET || process.env.BETTER_AUTH_SECRET
  );
}
export function cookieValue(headers: Headers, name: string) {
  return headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export function trackingAllowed(headers: Headers) {
  return (
    analyticsEnabled() &&
    headers.get("sec-gpc") !== "1" &&
    headers.get("dnt") !== "1" &&
    cookieValue(headers, "fdmd_analytics_choice") !== "off" &&
    (process.env.GROWTH_ANALYTICS_REQUIRE_CONSENT !== "1" ||
      cookieValue(headers, "fdmd_analytics_choice") === "on")
  );
}
export function visitorDigest(headers: Headers): string | null {
  const value = cookieValue(headers, VISITOR_COOKIE);
  const key = secret();
  if (!value || !key || value.length > 200) return null;
  const [token, signature, extra] = value.split(".");
  if (
    !token ||
    !signature ||
    extra !== undefined ||
    !/^[a-f0-9-]{36}$/.test(token)
  )
    return null;
  const expected = createHmac("sha256", key).update(token).digest("hex");
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  return createHash("sha256").update(token).digest("hex");
}
export function visitorCookie(
  value: string,
  secure: boolean,
  maxAge = 180 * 86400,
) {
  return `${VISITOR_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export function analyticsOrigin(request: Request) {
  // TLS terminates at Railway's proxy; the adapter's URL can use internal HTTP.
  // Use server configuration, never client-supplied forwarding headers.
  return new URL(
    process.env.PUBLIC_ORIGIN || process.env.BETTER_AUTH_URL || request.url,
  ).origin;
}
export function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") === analyticsOrigin(request) &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export function sanitizeAttribution(value: unknown, origin: string) {
  const parsed = attributionSchema.safeParse(value);
  if (!parsed.success) return {};
  const result: Record<string, string> = {};
  try {
    const referrer = new URL(parsed.data.referrer || "");
    if (
      ["http:", "https:"].includes(referrer.protocol) &&
      referrer.hostname !== new URL(origin).hostname
    )
      result.referrer = referrer.hostname;
  } catch {
    /* No referrer is unknown, not a proven direct visit. */
  }
  for (const name of ["source", "medium", "campaign"] as const) {
    const value = parsed.data[name];
    if (value && /^[a-zA-Z0-9 _.-]{1,80}$/.test(value)) result[name] = value;
  }
  return result;
}
export async function accountIdentity(db: DbExecutor, userId: string) {
  const result = await db.execute<{ id: string }>({
    sql: `INSERT INTO app.analytics_identities (id, kind, user_id, internal)
      VALUES ($1, 'account', $2, $3) ON CONFLICT(user_id) DO UPDATE SET internal = excluded.internal RETURNING id`,
    args: [
      randomUUID(),
      userId,
      (process.env.GROWTH_ANALYTICS_INTERNAL_USER_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .includes(userId),
    ],
  });
  return result.rows[0].id;
}
type Visitor = {
  identity_id: string;
  canonical_id: string | null;
  user_id: string | null;
  internal: boolean;
  anonymous_user_id: string | null;
};
async function lookup(db: DbExecutor, digest: string) {
  return (
    await db.execute<Visitor>({
      sql: `SELECT v.identity_id, i.canonical_id, c.user_id, c.internal, v.anonymous_user_id
      FROM app.analytics_visitors v JOIN app.analytics_identities i ON i.id=v.identity_id
      JOIN app.analytics_identities c ON c.id=coalesce(i.canonical_id,i.id)
      WHERE v.digest=$1 AND v.expires_at>now()`,
      args: [digest],
    })
  ).rows[0];
}
export async function resolveAnalyticsActor(
  request: Request,
  user?: AnalyticsUser | null,
): Promise<AnalyticsActor> {
  if (!trackingAllowed(request.headers)) return unknownActor;
  const browser =
    request.headers.get("sec-fetch-site") === "same-origin" ||
    request.headers.get("sec-fetch-mode") === "navigate" ||
    sameOrigin(request);
  const bot = isbot(request.headers.get("user-agent") || "");
  const verified = user?.emailVerified && !user.isAnonymous;
  return (
    (await analyticsWrite(async (db) => {
      const digest = visitorDigest(request.headers);
      const visitor = digest ? await lookup(db, digest) : null;
      const identityId = verified
        ? await accountIdentity(db, user.id)
        : visitor && !visitor.canonical_id
          ? visitor.identity_id
          : null;
      return {
        identityId,
        userId: verified ? user.id : undefined,
        source: browser ? "browser" : "api",
        audience: bot
          ? "bot"
          : visitor?.internal ||
              (verified &&
                (process.env.GROWTH_ANALYTICS_INTERNAL_USER_IDS || "")
                  .split(",")
                  .map((id) => id.trim())
                  .includes(user.id))
            ? "internal"
            : browser
              ? "product"
              : "unknown",
        authState: verified ? "verified" : identityId ? "anonymous" : "unknown",
      } satisfies AnalyticsActor;
    })) || {
      identityId: null,
      source: browser ? "browser" : "api",
      audience: bot ? "bot" : "unknown",
      authState: verified ? "verified" : "unknown",
    }
  );
}
export async function bootstrapVisitor(
  request: Request,
  user?: AnalyticsUser | null,
  attribution: unknown = {},
) {
  const origin = analyticsOrigin(request);
  const secure = new URL(origin).protocol === "https:";
  if (
    !trackingAllowed(request.headers) ||
    !secret() ||
    isbot(request.headers.get("user-agent") || "")
  ) {
    return { enabled: false, cookie: visitorCookie("", secure, 0) };
  }
  return (
    (await analyticsWrite(async (db) => {
      const verified = user?.emailVerified && !user.isAnonymous;
      const digest = visitorDigest(request.headers);
      const existing = digest ? await lookup(db, digest) : null;
      if (
        existing &&
        (!existing.canonical_id || (verified && existing.user_id === user.id))
      ) {
        await db.execute({
          sql: `UPDATE app.analytics_visitors SET last_seen_at=now(), expires_at=now()+interval '180 days', anonymous_user_id=coalesce($2,anonymous_user_id) WHERE digest=$1`,
          args: [digest!, user?.isAnonymous ? user.id : null],
        });
        return {
          enabled: true,
          cookie: visitorCookie(
            cookieValue(request.headers, VISITOR_COOKIE)!,
            secure,
          ),
        };
      }
      const token = randomUUID();
      const digestNew = createHash("sha256").update(token).digest("hex");
      const signature = createHmac("sha256", secret()!)
        .update(token)
        .digest("hex");
      await db.transaction(async (tx) => {
        const accountId = verified ? await accountIdentity(tx, user.id) : null;
        const id = randomUUID();
        await tx.execute({
          sql: `INSERT INTO app.analytics_identities (id,kind,canonical_id) VALUES ($1,'anonymous',$2)`,
          args: [id, accountId],
        });
        await tx.execute({
          sql: `INSERT INTO app.analytics_visitors (digest,identity_id,anonymous_user_id,attribution) VALUES ($1,$2,$3,$4::jsonb)`,
          args: [
            digestNew,
            id,
            user?.isAnonymous ? user.id : null,
            JSON.stringify(sanitizeAttribution(attribution, origin)),
          ],
        });
        await tx.execute(
          `INSERT INTO app.analytics_state(id) VALUES (true) ON CONFLICT DO NOTHING`,
        );
      });
      return {
        enabled: true,
        cookie: visitorCookie(`${token}.${signature}`, secure),
      };
    })) || { enabled: false }
  );
}
export async function linkAnalyticsVisitor(
  headers: Headers,
  user: AnalyticsUser,
) {
  if (!trackingAllowed(headers) || !user.emailVerified || user.isAnonymous)
    return;
  const digest = visitorDigest(headers);
  if (!digest) return;
  await analyticsWrite((db) =>
    db.transaction(async (tx) => {
      const visitor = await lookup(tx, digest);
      if (!visitor || visitor.canonical_id) return;
      const accountId = await accountIdentity(tx, user.id);
      await tx.execute({
        sql: `UPDATE app.analytics_identities SET canonical_id=$2 WHERE id=$1 AND kind='anonymous' AND canonical_id IS NULL`,
        args: [visitor.identity_id, accountId],
      });
      await tx.execute({
        sql: `UPDATE app.analytics_identities SET first_seen_at=least(first_seen_at,(SELECT first_seen_at FROM app.analytics_identities WHERE id=$1)), first_visited_at=least(first_visited_at,(SELECT first_visited_at FROM app.analytics_identities WHERE id=$1)), first_active_at=least(first_active_at,(SELECT first_active_at FROM app.analytics_identities WHERE id=$1)) WHERE id=$2`,
        args: [visitor.identity_id, accountId],
      });
    }),
  );
}
