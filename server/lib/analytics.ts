import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
  analyticsEnabled,
  analyticsHealth,
  analyticsWrite,
} from "./analytics-db.js";
import {
  resolveAnalyticsActor,
  trackingAllowed,
  type AnalyticsActor,
} from "./analytics-identity.js";
import {
  creatorEvents,
  type AnalyticsAudience,
  type ClientAnalyticsEvent,
} from "../../shared/analytics.js";

interface Context {
  actor: AnalyticsActor;
  requestId: string;
  operationId?: string;
  allowed: boolean;
}
const context = new AsyncLocalStorage<Context>();
export async function analyticsSession(request: Request) {
  if (!analyticsEnabled()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      import("./auth.js")
        .then(({ auth }) => auth.api.getSession({ headers: request.headers }))
        .catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 250);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function withGrowthRequest<T>(
  request: Request,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!analyticsEnabled()) return fn();
  const allowed = trackingAllowed(request.headers);
  const session = allowed ? await analyticsSession(request) : null;
  const actor = await resolveAnalyticsActor(request, session?.user);
  return context.run({ actor, allowed, requestId: randomUUID() }, fn);
}
export interface GrowthEvent {
  name: string;
  key: string;
  artifactId?: string;
  operationId?: string;
  durationMs?: number;
  audience?: AnalyticsAudience;
  trust?: "server" | "browser" | "billing";
  properties?: Record<string, unknown>;
}
export async function recordGrowthEvent(
  event: GrowthEvent,
  actor = context.getStore()?.actor,
) {
  if (!analyticsEnabled() || context.getStore()?.allowed === false) return;
  actor ??= {
    identityId: null,
    source: "direct",
    audience: "unknown",
    authState: "unknown",
  };
  const audience = ["internal", "bot"].includes(actor.audience)
    ? actor.audience
    : (event.audience ?? actor.audience);
  await analyticsWrite((db) =>
    db.transaction(async (tx) => {
      const result = await tx.execute({
        sql: `INSERT INTO app.analytics_events (id,deduplication_key,identity_id,name,source,audience,trust,auth_state,artifact_id,operation_id,duration_ms,properties)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) ON CONFLICT(deduplication_key) DO NOTHING RETURNING id`,
        args: [
          randomUUID(),
          event.key,
          actor.identityId,
          event.name,
          actor.source,
          audience,
          event.trust || "server",
          actor.authState,
          event.artifactId || null,
          event.operationId || null,
          event.durationMs === undefined
            ? null
            : Math.max(0, Math.round(event.durationMs)),
          JSON.stringify(event.properties || {}),
        ],
      });
      if (!result.rows.length) return;
      analyticsHealth.accepted++;
      await tx.execute(
        `INSERT INTO app.analytics_state(id) VALUES (true) ON CONFLICT DO NOTHING`,
      );
      if (
        actor.identityId &&
        actor.source === "browser" &&
        !["internal", "bot"].includes(audience) &&
        event.name === "page_viewed"
      ) {
        await tx.execute({
          sql: `UPDATE app.analytics_identities SET first_visited_at=least(first_visited_at,now()) WHERE id IN (SELECT id FROM app.analytics_identities WHERE id=$1 UNION SELECT canonical_id FROM app.analytics_identities WHERE id=$1)`,
          args: [actor.identityId],
        });
      }
      if (
        actor.identityId &&
        actor.source === "browser" &&
        audience === "product" &&
        (creatorEvents as readonly string[]).includes(event.name)
      ) {
        await tx.execute({
          sql: `UPDATE app.analytics_identities SET first_active_at=least(first_active_at,now()) WHERE id IN (SELECT id FROM app.analytics_identities WHERE id=$1 UNION SELECT canonical_id FROM app.analytics_identities WHERE id=$1)`,
          args: [actor.identityId],
        });
      }
    }),
  );
}
export async function recordAiStarted(operationId?: string, route = "enrich") {
  const current = context.getStore();
  if (!current) return;
  current.operationId = operationId;
  await recordGrowthEvent({
    name: "ai_started",
    key: `ai:${operationId || current.requestId}:started`,
    operationId,
    properties: { route },
  });
}
export async function recordAiOutcome(input: {
  route: string;
  status: string;
  quota: string;
  startedAt: number;
}) {
  const current = context.getStore();
  if (!current) return;
  await recordGrowthEvent({
    name:
      input.status === "success" && input.quota === "consumed"
        ? "ai_succeeded"
        : "ai_failed",
    key: `ai:${current.operationId || current.requestId}:completed`,
    operationId: current.operationId,
    durationMs: Math.max(0, Date.now() - input.startedAt * 1000),
    properties: {
      route: input.route,
      status: input.status,
      creditOutcome: input.quota,
    },
  });
}
export async function recordClientGrowthEvent(
  request: Request,
  event: ClientAnalyticsEvent,
) {
  if (!trackingAllowed(request.headers)) return;
  const session = await analyticsSession(request);
  const actor = await resolveAnalyticsActor(request, session?.user);
  let audience: AnalyticsAudience =
    event.page === "examples"
      ? "example"
      : event.page === "public_snapshot"
        ? "public_share"
        : "unknown";
  if (event.name === "page_viewed")
    audience = event.page === "workspace" ? "product" : audience;
  else if (event.artifactId && actor.identityId && event.page !== "examples") {
    const ownsArtifact = await analyticsWrite(async (db) => {
      const result = await db.execute({
        sql: `SELECT 1 FROM app.analytics_events e JOIN app.analytics_identities i ON i.id=e.identity_id
          JOIN app.analytics_identities current ON current.id=$2
          WHERE e.artifact_id=$1 AND e.name='extraction_succeeded'
            AND coalesce(i.canonical_id,i.id)=coalesce(current.canonical_id,current.id)
          UNION ALL SELECT 1 FROM app.fdmd_saved_enrichments WHERE id=$1 AND owner_id=$3 LIMIT 1`,
        args: [event.artifactId, actor.identityId, actor.userId || ""],
      });
      return result.rows.length > 0;
    });
    if (ownsArtifact) audience = "product";
  }
  await recordGrowthEvent(
    {
      name: event.name,
      key: `browser:${event.id}`,
      artifactId: event.artifactId,
      trust: "browser",
      audience,
      properties: {
        page: event.page,
        format: event.format,
        variant: event.variant,
      },
    },
    actor,
  );
}
