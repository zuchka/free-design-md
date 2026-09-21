import { sql } from "drizzle-orm";
import { integer, sqliteTable as table, text } from "drizzle-orm/sqlite-core";

const now = () => sql`(datetime('now'))`;

function ownableColumns() {
  return {
    ownerEmail: text("owner_email").notNull().default("legacy"),
    orgId: text("org_id"),
    visibility: text("visibility").notNull().default("private"),
  };
}

function createSharesTable(name: string) {
  return table(name, {
    id: text("id").primaryKey(),
    resourceId: text("resource_id").notNull(),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    role: text("role").notNull().default("viewer"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(now()),
  });
}

export const decks = table("decks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  data: text("data").notNull(), // Full deck JSON
  designSystemId: text("design_system_id"),
  createdAt: text("created_at").default(now()),
  updatedAt: text("updated_at").default(now()),
  ...ownableColumns(),
});

export const deckShares = createSharesTable("deck_shares");

export const deckVersions = table("deck_versions", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull().default("local@localhost"),
  deckId: text("deck_id").notNull(),
  title: text("title").notNull(),
  data: text("data").notNull(),
  changeLabel: text("change_label"),
  createdAt: text("created_at").notNull().default(now()),
});

export const designSystems = table("design_systems", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  data: text("data").notNull(),
  assets: text("assets"),
  customInstructions: text("custom_instructions").notNull().default(""),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").default(now()),
  updatedAt: text("updated_at").default(now()),
  ...ownableColumns(),
});

export const designSystemShares = createSharesTable("design_system_shares");

// Persisted public share-link snapshots (token → deck snapshot).
// Replaces the old in-memory Map so links survive server restarts and
// work across multiple serverless instances.
export const deckShareLinks = table("deck_share_links", {
  token: text("token").primaryKey(),
  title: text("title").notNull(),
  slides: text("slides").notNull(), // JSON array of slide snapshots
  aspectRatio: text("aspect_ratio"),
  createdAt: text("created_at").notNull().default(now()),
});

export const slideComments = table("slide_comments", {
  id: text("id").primaryKey(),
  deckId: text("deck_id").notNull(),
  slideId: text("slide_id").notNull(),
  threadId: text("thread_id").notNull(),
  parentId: text("parent_id"),
  content: text("content").notNull(),
  quotedText: text("quoted_text"),
  authorEmail: text("author_email").notNull(),
  authorName: text("author_name"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

/**
 * Cache of AI-enriched DESIGN.md results.
 *
 * The cacheKey is `${url}::${promptVersion}` — a second enrichment of
 * the same URL with the same prompt version skips the LLM call
 * entirely. Pre-bake demo brands (stripe/linear/notion) before a demo
 * so the live walk-through never hits a 30-60s latency.
 *
 * promptVersion is the constant exported from actions/enrich-prompt.ts —
 * bumping it invalidates every row naturally because the cache key
 * changes.
 *
 * usageJson stores the original EnrichResult.usage object as JSON so
 * the UI's token-cost strip stays truthful on cache-served replies.
 */
export const enrichmentCache = table("enrichment_cache", {
  cacheKey: text("cache_key").primaryKey(),
  url: text("url").notNull(),
  promptVersion: text("prompt_version").notNull(),
  markdown: text("markdown").notNull(),
  model: text("model").notNull(),
  usageJson: text("usage_json").notNull(),
  stopReason: text("stop_reason"),
  createdAt: text("created_at").notNull().default(now()),
});

export const fdmdSavedEnrichments = table("fdmd_saved_enrichments", {
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
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const fdmdMetricCounters = table("fdmd_metric_counters", {
  name: text("name").notNull(),
  labelKey: text("label_key").notNull(),
  labelsJson: text("labels_json").notNull(),
  value: integer("value").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const authUsers = table("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const authSessions = table("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
});

export const authAccounts = table("auth_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const authVerifications = table("auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const creditWallets = table("credit_wallets", {
  ownerId: text("owner_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const creditLedger = table("credit_ledger", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  delta: integer("delta").notNull(),
  kind: text("kind").notNull(),
  referenceId: text("reference_id").notNull().unique(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(now()),
});

export const creditOperations = table("credit_operations", {
  operationId: text("operation_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const purchases = table("purchases", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  packId: text("pack_id").notNull(),
  credits: integer("credits").notNull(),
  amountTotal: integer("amount_total"),
  currency: text("currency"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull().default(now()),
  fulfilledAt: text("fulfilled_at"),
});

export const stripeEvents = table("stripe_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: text("processed_at").notNull().default(now()),
});
