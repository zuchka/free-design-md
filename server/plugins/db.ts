import { runMigrations } from "@agent-native/core/db";

export default runMigrations(
  [
    {
      version: 1,
      sql: `CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
    },
    {
      version: 2,
      sql: `CREATE TABLE IF NOT EXISTS slide_comments (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL,
    slide_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    parent_id TEXT,
    content TEXT NOT NULL,
    quoted_text TEXT,
    author_email TEXT NOT NULL,
    author_name TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    // v3-v5: sharing columns for decks.
    {
      version: 3,
      sql: `ALTER TABLE decks ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT 'local@localhost'`,
    },
    {
      version: 4,
      sql: `ALTER TABLE decks ADD COLUMN IF NOT EXISTS org_id TEXT`,
    },
    {
      version: 5,
      sql: `ALTER TABLE decks ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'`,
    },
    // v6: companion shares table for per-principal grants.
    {
      version: 6,
      sql: `CREATE TABLE IF NOT EXISTS deck_shares (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    principal_type TEXT NOT NULL,
    principal_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    // v7: design systems table
    {
      version: 7,
      sql: `CREATE TABLE IF NOT EXISTS design_systems (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    data TEXT NOT NULL,
    assets TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    owner_email TEXT NOT NULL DEFAULT 'local@localhost',
    org_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'private'
  )`,
    },
    // v8: companion shares table for design systems
    {
      version: 8,
      sql: `CREATE TABLE IF NOT EXISTS design_system_shares (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    principal_type TEXT NOT NULL,
    principal_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    // v9: link decks to design systems
    {
      version: 9,
      sql: `ALTER TABLE decks ADD COLUMN IF NOT EXISTS design_system_id TEXT`,
    },
    // v10-v15: fix boolean columns on Postgres only. The adaptSqlForPostgres
    // rewriter turns INTEGER → BIGINT, so migrations v2 & v7 created the columns
    // as bigint. Drizzle's integer({ mode: "boolean" }) maps to pg boolean, so
    // inserts send a JS boolean that Postgres rejects ("column is of type bigint
    // but expression is of type boolean"). Convert both columns to boolean.
    // SQLite doesn't need this — its INTEGER works fine with boolean mode.
    {
      version: 10,
      sql: {
        postgres: `ALTER TABLE design_systems ALTER COLUMN is_default DROP DEFAULT`,
      },
    },
    {
      version: 11,
      sql: {
        postgres: `ALTER TABLE design_systems ALTER COLUMN is_default TYPE boolean USING is_default::int::boolean`,
      },
    },
    {
      version: 12,
      sql: {
        postgres: `ALTER TABLE design_systems ALTER COLUMN is_default SET DEFAULT false`,
      },
    },
    {
      version: 13,
      sql: {
        postgres: `ALTER TABLE slide_comments ALTER COLUMN resolved DROP DEFAULT`,
      },
    },
    {
      version: 14,
      sql: {
        postgres: `ALTER TABLE slide_comments ALTER COLUMN resolved TYPE boolean USING resolved::int::boolean`,
      },
    },
    {
      version: 15,
      sql: {
        postgres: `ALTER TABLE slide_comments ALTER COLUMN resolved SET DEFAULT false`,
      },
    },
    // v16: persist public share-link snapshots to DB so they survive server
    // restarts and work across multiple serverless instances.
    {
      version: 16,
      sql: `CREATE TABLE IF NOT EXISTS deck_share_links (
    token TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slides TEXT NOT NULL,
    aspect_ratio TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    {
      version: 17,
      sql: `ALTER TABLE design_systems ADD COLUMN IF NOT EXISTS custom_instructions TEXT NOT NULL DEFAULT ''`,
    },
    {
      version: 18,
      sql: `CREATE TABLE IF NOT EXISTS deck_versions (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL DEFAULT 'local@localhost',
    deck_id TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT NOT NULL,
    change_label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS deck_versions_deck_owner_created_idx ON deck_versions (deck_id, owner_email, created_at)`,
    },
    // v21: per-user AI-enrichment quota. Prefixed fdmd_ to avoid collisions
    // with future framework tables.
    {
      version: 21,
      sql: `CREATE TABLE IF NOT EXISTS fdmd_quota (
    user_id TEXT PRIMARY KEY,
    enrich_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    // v22: bonus_credits column on fdmd_quota — the finite AI credit allowance
    // for Builder-connected accounts that are not paid/Enterprise unlimited.
    {
      version: 22,
      sql: `ALTER TABLE fdmd_quota ADD COLUMN IF NOT EXISTS bonus_credits INTEGER NOT NULL DEFAULT 0`,
    },
    // v23: deduplication table for Builder.io API keys — prevents the same
    // key from unlocking quota on multiple accounts. Retained for old rows.
    {
      version: 23,
      sql: `CREATE TABLE IF NOT EXISTS fdmd_builder_keys (
    api_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    verified_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    // v24: per-extraction iteration history for the AI-enriched memo.
    // Each row is one user-prompted revision of a prior memo.
    {
      version: 24,
      sql: `CREATE TABLE IF NOT EXISTS fdmd_iterations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    parent_id TEXT,
    url TEXT NOT NULL,
    owner TEXT NOT NULL,
    user_prompt TEXT NOT NULL,
    section_target TEXT,
    markdown TEXT NOT NULL,
    model TEXT NOT NULL,
    usage_json TEXT,
    stop_reason TEXT,
    rejected_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS fdmd_iter_session_created_idx ON fdmd_iterations (session_id, created_at);
  CREATE INDEX IF NOT EXISTS fdmd_iter_owner_created_idx ON fdmd_iterations (owner, created_at)`,
    },
    // v25: seed default iteration credits for existing fdmd_quota rows where
    // bonus_credits is still 0. New rows are seeded with the default at insert
    // time via getCredits().
    {
      version: 25,
      sql: `UPDATE fdmd_quota SET bonus_credits = 3 WHERE bonus_credits = 0`,
    },
    // v26: per-visitor BYO Anthropic API key store. The token is the value
    // of the `fdmd_anon` cookie set by server/plugins/anon-session.ts.
    {
      version: 26,
      sql: `CREATE TABLE IF NOT EXISTS fdmd_byo_keys (
    token TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
    },
    {
      version: 27,
      sql: `CREATE TABLE IF NOT EXISTS fdmd_saved_enrichments (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    builder_user_id TEXT NOT NULL,
    builder_org_name TEXT,
    builder_org_kind TEXT,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    deterministic_markdown TEXT NOT NULL,
    enriched_markdown TEXT NOT NULL,
    design_system_data_json TEXT NOT NULL,
    signals_json TEXT NOT NULL,
    screenshot_data_url TEXT,
    model TEXT NOT NULL,
    usage_json TEXT NOT NULL,
    stop_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_owner_created_idx ON fdmd_saved_enrichments (owner_id, created_at);
  CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_source_url_idx ON fdmd_saved_enrichments (source_url)`,
    },
    {
      version: 28,
      sql: `ALTER TABLE fdmd_saved_enrichments ADD COLUMN IF NOT EXISTS parent_id TEXT;
  ALTER TABLE fdmd_saved_enrichments ADD COLUMN IF NOT EXISTS root_id TEXT;
  ALTER TABLE fdmd_saved_enrichments ADD COLUMN IF NOT EXISTS iteration_prompt TEXT;
  CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_parent_idx ON fdmd_saved_enrichments (parent_id);
  CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_root_created_idx ON fdmd_saved_enrichments (root_id, created_at)`,
    },
  ],
  { table: "slides_migrations" },
);
