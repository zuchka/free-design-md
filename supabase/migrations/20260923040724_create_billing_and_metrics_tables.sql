-- Create financial and operational tables from the active SQLite runtime.
-- Constraints mirror existing behavior; additional hardening waits until the
-- production snapshot has been checked for legacy values.

create table app.fdmd_metric_counters (
  name text not null,
  label_key text not null,
  labels_json text not null,
  value integer not null default 0,
  updated_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  primary key (name, label_key)
);

create table app.credit_wallets (
  owner_id text primary key,
  balance integer not null default 0,
  lifetime_purchased integer not null default 0,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  updated_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  constraint credit_wallets_balance_check check (balance >= 0)
);

create table app.credit_ledger (
  id text primary key,
  owner_id text not null,
  delta integer not null,
  kind text not null,
  reference_id text not null,
  metadata_json text,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  constraint credit_ledger_reference_id_key unique (reference_id)
);

create index credit_ledger_owner_created_idx
  on app.credit_ledger (owner_id, created_at);

create table app.credit_operations (
  operation_id text primary key,
  owner_id text not null,
  kind text not null,
  status text not null,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  updated_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  )
);

create table app.purchases (
  id text primary key,
  owner_id text not null,
  stripe_checkout_session_id text not null,
  stripe_payment_intent_id text,
  pack_id text not null,
  credits integer not null,
  amount_total integer,
  currency text,
  status text not null,
  created_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  ),
  fulfilled_at text,
  constraint purchases_stripe_checkout_session_id_key
    unique (stripe_checkout_session_id)
);

create index purchases_owner_created_idx
  on app.purchases (owner_id, created_at);

create table app.stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at text not null default to_char(
    timezone('utc', statement_timestamp()),
    'YYYY-MM-DD HH24:MI:SS'
  )
);

-- Repeat the runtime grant explicitly so this migration stays correct if it is
-- applied by a migration owner whose default privileges differ from postgres.
grant select, insert, update, delete
  on all tables in schema app
  to free_design_app;
