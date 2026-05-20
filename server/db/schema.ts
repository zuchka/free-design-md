import {
  table,
  text,
  integer,
  now,
  ownableColumns,
  createSharesTable,
} from "@agent-native/core/db/schema";

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

/**
 * Per-user AI-enrichment quota. Seeded to 3 on the user's first
 * verified callback. Decremented atomically by the enrich endpoint
 * on successful completion.
 */
export const fdmdQuota = table("fdmd_quota", {
  userId: text("user_id").primaryKey(),
  enrichCount: integer("enrich_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});
