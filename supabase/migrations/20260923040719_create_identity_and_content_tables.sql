-- Create Better Auth and content tables from the active SQLite runtime.
-- JSON payloads and application-owned timestamps intentionally remain text so
-- the first data migration can preserve exact source values.

create table app.auth_users (
  id text primary key,
  name text not null,
  email text not null,
  email_verified boolean not null default false,
  image text,
  is_anonymous boolean not null default false,
  created_at timestamp without time zone not null,
  updated_at timestamp without time zone not null,
  constraint auth_users_email_key unique (email)
);

create table app.auth_sessions (
  id text primary key,
  expires_at timestamp without time zone not null,
  token text not null,
  created_at timestamp without time zone not null,
  updated_at timestamp without time zone not null,
  ip_address text,
  user_agent text,
  user_id text not null,
  constraint auth_sessions_token_key unique (token),
  constraint auth_sessions_user_id_fkey
    foreign key (user_id)
    references app.auth_users (id)
    on delete cascade
);

create index auth_sessions_user_id_idx
  on app.auth_sessions (user_id);

create table app.auth_accounts (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamp without time zone,
  refresh_token_expires_at timestamp without time zone,
  scope text,
  password text,
  created_at timestamp without time zone not null,
  updated_at timestamp without time zone not null,
  constraint auth_accounts_user_id_fkey
    foreign key (user_id)
    references app.auth_users (id)
    on delete cascade
);

create index auth_accounts_user_id_idx
  on app.auth_accounts (user_id);

create table app.auth_verifications (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamp without time zone not null,
  created_at timestamp without time zone,
  updated_at timestamp without time zone
);

create index auth_verifications_identifier_idx
  on app.auth_verifications (identifier);

create table app.enrichment_cache (
  cache_key text primary key,
  url text not null,
  prompt_version text not null,
  markdown text not null,
  model text not null,
  usage_json text not null,
  stop_reason text,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  )
);

create table app.fdmd_iterations (
  id text primary key,
  session_id text not null,
  parent_id text,
  url text not null,
  owner text not null,
  user_prompt text not null,
  section_target text,
  markdown text not null,
  model text not null,
  usage_json text,
  stop_reason text,
  rejected_reason text,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  )
);

create index fdmd_iter_session_created_idx
  on app.fdmd_iterations (session_id, created_at);

create index fdmd_iter_owner_created_idx
  on app.fdmd_iterations (owner, created_at);

create table app.fdmd_saved_enrichments (
  id text primary key,
  owner_id text not null,
  source_url text not null,
  title text not null,
  parent_id text,
  root_id text,
  iteration_prompt text,
  deterministic_markdown text not null,
  enriched_markdown text not null,
  design_system_data_json text not null,
  signals_json text not null,
  screenshot_data_url text,
  model text not null,
  usage_json text not null,
  stop_reason text,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  updated_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  )
);

create index fdmd_saved_enrichments_owner_created_idx
  on app.fdmd_saved_enrichments (owner_id, created_at);

create index fdmd_saved_enrichments_source_url_idx
  on app.fdmd_saved_enrichments (source_url);

create index fdmd_saved_enrichments_parent_idx
  on app.fdmd_saved_enrichments (parent_id);

create index fdmd_saved_enrichments_root_created_idx
  on app.fdmd_saved_enrichments (root_id, created_at);
