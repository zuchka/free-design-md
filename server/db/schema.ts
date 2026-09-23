import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
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
