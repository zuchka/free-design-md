import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  type AnyPgColumn,
  check,
  index,
  integer,
  pgSchema,
  pgPolicy,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const appSchema = pgSchema("app");

const textTimestampDefault = sql`to_char(
  timezone('utc', statement_timestamp()),
  'YYYY-MM-DD HH24:MI:SS'
)`;

export const authUsers = appSchema.table(
  "auth_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [unique("auth_users_email_key").on(table.email)],
);

export const authSessions = appSchema.table(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("auth_sessions_token_key").on(table.token),
    index("auth_sessions_user_id_idx").on(table.userId),
  ],
);

export const authAccounts = appSchema.table(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull(),
  },
  (table) => [index("auth_accounts_user_id_idx").on(table.userId)],
);

export const authVerifications = appSchema.table(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }),
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const enrichmentCache = appSchema.table("enrichment_cache", {
  cacheKey: text("cache_key").primaryKey(),
  url: text("url").notNull(),
  promptVersion: text("prompt_version").notNull(),
  markdown: text("markdown").notNull(),
  model: text("model").notNull(),
  usageJson: text("usage_json").notNull(),
  stopReason: text("stop_reason"),
  createdAt: text("created_at").notNull().default(textTimestampDefault),
});

export const fdmdIterations = appSchema.table(
  "fdmd_iterations",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    parentId: text("parent_id"),
    url: text("url").notNull(),
    owner: text("owner").notNull(),
    userPrompt: text("user_prompt").notNull(),
    sectionTarget: text("section_target"),
    markdown: text("markdown").notNull(),
    model: text("model").notNull(),
    usageJson: text("usage_json"),
    stopReason: text("stop_reason"),
    rejectedReason: text("rejected_reason"),
    createdAt: text("created_at").notNull().default(textTimestampDefault),
  },
  (table) => [
    index("fdmd_iter_session_created_idx").on(table.sessionId, table.createdAt),
    index("fdmd_iter_owner_created_idx").on(table.owner, table.createdAt),
  ],
);

export const fdmdSavedEnrichments = appSchema.table(
  "fdmd_saved_enrichments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    parentId: text("parent_id"),
    rootId: text("root_id"),
    iterationPrompt: text("iteration_prompt"),
    deterministicMarkdown: text("deterministic_markdown").notNull(),
    enrichedMarkdown: text("enriched_markdown").notNull(),
    designSystemDataJson: text("design_system_data_json").notNull(),
    signalsJson: text("signals_json").notNull(),
    screenshotDataUrl: text("screenshot_data_url"),
    model: text("model").notNull(),
    usageJson: text("usage_json").notNull(),
    stopReason: text("stop_reason"),
    createdAt: text("created_at").notNull().default(textTimestampDefault),
    updatedAt: text("updated_at").notNull().default(textTimestampDefault),
  },
  (table) => [
    index("fdmd_saved_enrichments_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    index("fdmd_saved_enrichments_source_url_idx").on(table.sourceUrl),
    index("fdmd_saved_enrichments_parent_idx").on(table.parentId),
    index("fdmd_saved_enrichments_root_created_idx").on(
      table.rootId,
      table.createdAt,
    ),
  ],
);

export const fdmdMetricCounters = appSchema.table(
  "fdmd_metric_counters",
  {
    name: text("name").notNull(),
    labelKey: text("label_key").notNull(),
    labelsJson: text("labels_json").notNull(),
    value: integer("value").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(textTimestampDefault),
  },
  (table) => [primaryKey({ columns: [table.name, table.labelKey] })],
);

export const fdmdExtractionRequests = appSchema
  .table(
    "fdmd_extraction_requests",
    {
      requestId: uuid("request_id").primaryKey(),
      url: text("url"),
      completedAt: timestamp("completed_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      caller: text("caller").notNull(),
      status: text("status").notNull(),
      code: text("code").notNull(),
      stage: text("stage").notNull(),
      durationMs: integer("duration_ms").notNull(),
      upstreamStatus: integer("upstream_status"),
      retried: boolean("retried").notNull(),
    },
    (table) => [
      check(
        "fdmd_extraction_requests_url_check",
        sql`length(${table.url}) <= 2048`,
      ),
      check(
        "fdmd_extraction_requests_caller_check",
        sql`${table.caller} in ('http', 'direct')`,
      ),
      check(
        "fdmd_extraction_requests_status_check",
        sql`${table.status} in ('success', 'error')`,
      ),
      check(
        "fdmd_extraction_requests_duration_ms_check",
        sql`${table.durationMs} >= 0`,
      ),
      index("fdmd_extraction_requests_completed_idx").on(
        table.completedAt.desc(),
        table.requestId.desc(),
      ),
      index("fdmd_extraction_requests_http_status_idx")
        .on(table.status, table.completedAt.desc(), table.requestId.desc())
        .where(sql`${table.caller} = 'http'`),
      pgPolicy("extraction_history_runtime", {
        to: "free_design_app",
        using: sql`true`,
        withCheck: sql`true`,
      }),
    ],
  )
  .enableRLS();

export const creditWallets = appSchema.table(
  "credit_wallets",
  {
    ownerId: text("owner_id").primaryKey(),
    balance: integer("balance").notNull().default(0),
    lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
    createdAt: text("created_at").notNull().default(textTimestampDefault),
    updatedAt: text("updated_at").notNull().default(textTimestampDefault),
  },
  (table) => [
    check("credit_wallets_balance_check", sql`${table.balance} >= 0`),
  ],
);

export const creditLedger = appSchema.table(
  "credit_ledger",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    delta: integer("delta").notNull(),
    kind: text("kind").notNull(),
    referenceId: text("reference_id").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull().default(textTimestampDefault),
  },
  (table) => [
    unique("credit_ledger_reference_id_key").on(table.referenceId),
    index("credit_ledger_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export const creditOperations = appSchema.table("credit_operations", {
  operationId: text("operation_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(textTimestampDefault),
  updatedAt: text("updated_at").notNull().default(textTimestampDefault),
});

export const purchases = appSchema.table(
  "purchases",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    packId: text("pack_id").notNull(),
    credits: integer("credits").notNull(),
    amountTotal: integer("amount_total"),
    currency: text("currency"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(textTimestampDefault),
    fulfilledAt: text("fulfilled_at"),
  },
  (table) => [
    unique("purchases_stripe_checkout_session_id_key").on(
      table.stripeCheckoutSessionId,
    ),
    index("purchases_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export const stripeEvents = appSchema.table("stripe_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: text("processed_at").notNull().default(textTimestampDefault),
});

export const analyticsIdentities = appSchema.table(
  "analytics_identities",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull(),
    userId: text("user_id").unique(),
    canonicalId: uuid("canonical_id").references(
      (): AnyPgColumn => analyticsIdentities.id,
    ),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    firstVisitedAt: timestamp("first_visited_at", { withTimezone: true }),
    firstActiveAt: timestamp("first_active_at", { withTimezone: true }),
    internal: boolean("internal").notNull().default(false),
  },
  (t) => [
    check(
      "analytics_identities_kind_check",
      sql`${t.kind} in ('anonymous','account')`,
    ),
    check(
      "analytics_identities_check",
      sql`${t.canonicalId} is null or (${t.kind}='anonymous' and ${t.canonicalId}<>${t.id})`,
    ),
    index("analytics_identity_canonical_idx").on(t.canonicalId),
    index("analytics_identity_resolved_idx").on(
      sql`coalesce(${t.canonicalId},${t.id})`,
    ),
  ],
);
export const analyticsVisitors = appSchema.table(
  "analytics_visitors",
  {
    digest: text("digest").primaryKey(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => analyticsIdentities.id),
    anonymousUserId: text("anonymous_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now()+interval '180 days'`),
    attribution: jsonb("attribution").notNull().default({}),
  },
  (t) => [
    index("analytics_visitors_identity_idx").on(t.identityId),
    index("analytics_visitors_expiry_idx").on(t.expiresAt),
  ],
);
export const analyticsEvents = appSchema.table(
  "analytics_events",
  {
    id: uuid("id").primaryKey(),
    deduplicationKey: text("deduplication_key").notNull().unique(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    identityId: uuid("identity_id").references(() => analyticsIdentities.id),
    name: text("name").notNull(),
    source: text("source").notNull(),
    audience: text("audience").notNull(),
    trust: text("trust").notNull(),
    authState: text("auth_state").notNull(),
    definitionVersion: integer("definition_version").notNull().default(1),
    artifactId: text("artifact_id"),
    operationId: text("operation_id"),
    durationMs: integer("duration_ms"),
    properties: jsonb("properties").notNull().default({}),
  },
  (t) => [
    check(
      "analytics_events_source_check",
      sql`${t.source} in ('browser','api','direct','historical')`,
    ),
    check(
      "analytics_events_audience_check",
      sql`${t.audience} in ('product','example','public_share','internal','bot','unknown')`,
    ),
    check(
      "analytics_events_trust_check",
      sql`${t.trust} in ('server','browser','billing')`,
    ),
    check(
      "analytics_events_auth_state_check",
      sql`${t.authState} in ('anonymous','verified','unknown')`,
    ),
    check("analytics_events_duration_ms_check", sql`${t.durationMs}>=0`),
    index("analytics_events_time_idx").on(t.occurredAt),
    index("analytics_events_identity_time_idx").on(t.identityId, t.occurredAt),
    index("analytics_events_name_time_idx").on(t.name, t.occurredAt),
    index("analytics_events_artifact_idx")
      .on(t.artifactId)
      .where(sql`${t.artifactId} is not null`),
    index("analytics_events_operation_idx")
      .on(t.operationId)
      .where(sql`${t.operationId} is not null`),
  ],
);
export const analyticsState = appSchema.table(
  "analytics_state",
  {
    id: boolean("id").primaryKey().default(true),
    collectionStartedAt: timestamp("collection_started_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    lastMaintenanceAt: timestamp("last_maintenance_at", { withTimezone: true }),
  },
  (t) => [check("analytics_state_id_check", sql`${t.id}`)],
);
export const analyticsLinkIntents = appSchema.table("analytics_link_intents", {
  anonymousUserId: text("anonymous_user_id").primaryKey(),
  verifiedUserId: text("verified_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
