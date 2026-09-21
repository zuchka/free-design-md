import { getDbExec } from "./client.js";

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS enrichment_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  markdown TEXT NOT NULL,
  model TEXT NOT NULL,
  usage_json TEXT NOT NULL,
  stop_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS fdmd_iterations (
  id TEXT PRIMARY KEY NOT NULL,
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
CREATE INDEX IF NOT EXISTS fdmd_iter_owner_created_idx ON fdmd_iterations (owner, created_at);
CREATE TABLE IF NOT EXISTS fdmd_saved_enrichments (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  parent_id TEXT,
  root_id TEXT,
  iteration_prompt TEXT,
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
CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_source_url_idx ON fdmd_saved_enrichments (source_url);
CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_parent_idx ON fdmd_saved_enrichments (parent_id);
CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_root_created_idx ON fdmd_saved_enrichments (root_id, created_at);
CREATE TABLE IF NOT EXISTS fdmd_metric_counters (
  name TEXT NOT NULL,
  label_key TEXT NOT NULL,
  labels_json TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (name, label_key)
);
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);
CREATE TABLE IF NOT EXISTS auth_verifications (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS auth_verifications_identifier_idx ON auth_verifications (identifier);
CREATE TABLE IF NOT EXISTS credit_wallets (
  owner_id TEXT PRIMARY KEY NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL,
  reference_id TEXT NOT NULL UNIQUE,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS credit_ledger_owner_created_idx ON credit_ledger (owner_id, created_at);
CREATE TABLE IF NOT EXISTS credit_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  pack_id TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount_total INTEGER,
  currency TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT
);
CREATE INDEX IF NOT EXISTS purchases_owner_created_idx ON purchases (owner_id, created_at);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function migrateLegacySavedEnrichments() {
  const db = getDbExec();
  const columns = await db.execute("PRAGMA table_info(fdmd_saved_enrichments)");
  if (!columns.rows.some((row) => row.name === "builder_user_id")) return;

  await db.executeMultiple(`
    DROP TABLE IF EXISTS fdmd_saved_enrichments_v2;
    CREATE TABLE fdmd_saved_enrichments_v2 (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      parent_id TEXT,
      root_id TEXT,
      iteration_prompt TEXT,
      deterministic_markdown TEXT NOT NULL,
      enriched_markdown TEXT NOT NULL,
      design_system_data_json TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      screenshot_data_url TEXT,
      model TEXT NOT NULL,
      usage_json TEXT NOT NULL,
      stop_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO fdmd_saved_enrichments_v2 (
      id, owner_id, source_url, title, parent_id, root_id, iteration_prompt,
      deterministic_markdown, enriched_markdown, design_system_data_json,
      signals_json, screenshot_data_url, model, usage_json, stop_reason,
      created_at, updated_at
    ) SELECT
      id, owner_id, source_url, title, parent_id, root_id, iteration_prompt,
      deterministic_markdown, enriched_markdown, design_system_data_json,
      signals_json, screenshot_data_url, model, usage_json, stop_reason,
      created_at, updated_at
    FROM fdmd_saved_enrichments;
    DROP TABLE fdmd_saved_enrichments;
    ALTER TABLE fdmd_saved_enrichments_v2 RENAME TO fdmd_saved_enrichments;
  `);
}

export async function migrateDatabase() {
  const db = getDbExec();
  await db.executeMultiple(BASE_SCHEMA);
  await migrateLegacySavedEnrichments();
  await db.executeMultiple(`
    DROP TABLE IF EXISTS fdmd_users;
    DROP TABLE IF EXISTS fdmd_sessions;
    DROP TABLE IF EXISTS fdmd_builder_keys;
    DROP TABLE IF EXISTS fdmd_quota;
    DROP TABLE IF EXISTS fdmd_credit_promos;
    DROP TABLE IF EXISTS fdmd_byo_keys;
    CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_owner_created_idx ON fdmd_saved_enrichments (owner_id, created_at);
    CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_source_url_idx ON fdmd_saved_enrichments (source_url);
    CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_parent_idx ON fdmd_saved_enrichments (parent_id);
    CREATE INDEX IF NOT EXISTS fdmd_saved_enrichments_root_created_idx ON fdmd_saved_enrichments (root_id, created_at);
  `);
}
