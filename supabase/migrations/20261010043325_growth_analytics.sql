create table app.analytics_identities (
  id uuid primary key,
  kind text not null check (kind in ('anonymous', 'account')),
  user_id text unique,
  canonical_id uuid references app.analytics_identities(id),
  first_seen_at timestamptz not null default now(),
  first_active_at timestamptz,
  first_visited_at timestamptz,
  internal boolean not null default false,
  check (canonical_id is null or (kind = 'anonymous' and canonical_id <> id))
);
create index analytics_identity_canonical_idx on app.analytics_identities(canonical_id);
create index analytics_identity_resolved_idx on app.analytics_identities((coalesce(canonical_id,id)));
create table app.analytics_visitors (
  digest text primary key,
  identity_id uuid not null references app.analytics_identities(id),
  anonymous_user_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days',
  attribution jsonb not null default '{}'::jsonb
);
create index analytics_visitors_identity_idx on app.analytics_visitors(identity_id);
create index analytics_visitors_expiry_idx on app.analytics_visitors(expires_at);
create table app.analytics_events (
  id uuid primary key,
  deduplication_key text not null unique,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  identity_id uuid references app.analytics_identities(id),
  name text not null,
  source text not null check (source in ('browser','api','direct','historical')),
  audience text not null check (audience in ('product','example','public_share','internal','bot','unknown')),
  trust text not null check (trust in ('server','browser','billing')),
  auth_state text not null check (auth_state in ('anonymous','verified','unknown')),
  definition_version integer not null default 1,
  artifact_id text,
  operation_id text,
  duration_ms integer check (duration_ms >= 0),
  properties jsonb not null default '{}'::jsonb
);
create index analytics_events_time_idx on app.analytics_events(occurred_at);
create index analytics_events_identity_time_idx on app.analytics_events(identity_id, occurred_at);
create index analytics_events_name_time_idx on app.analytics_events(name, occurred_at);
create index analytics_events_artifact_idx on app.analytics_events(artifact_id) where artifact_id is not null;
create index analytics_events_operation_idx on app.analytics_events(operation_id) where operation_id is not null;
create table app.analytics_state (
  id boolean primary key default true check (id),
  collection_started_at timestamptz not null default now(),
  last_maintenance_at timestamptz
);
-- Recover account links independently of the ephemeral Better Auth anonymous user.
create table app.analytics_link_intents (
  anonymous_user_id text primary key,
  verified_user_id text not null,
  created_at timestamptz not null default now()
);
revoke all on app.analytics_identities, app.analytics_visitors, app.analytics_events,
  app.analytics_state, app.analytics_link_intents from public, anon, authenticated;
grant select, insert, update, delete on app.analytics_identities, app.analytics_visitors,
  app.analytics_events, app.analytics_state, app.analytics_link_intents to free_design_app;
