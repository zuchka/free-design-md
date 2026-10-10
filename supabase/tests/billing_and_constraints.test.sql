begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'credit_wallets_balance_check'
      and c.contype = 'c'
  ),
  'wallet balance cannot be negative'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'credit_ledger_reference_id_key'
      and c.contype = 'u'
  ),
  'credit ledger references are idempotent'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'purchases_stripe_checkout_session_id_key'
      and c.contype = 'u'
  ),
  'Stripe checkout sessions are unique'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'stripe_events_pkey'
      and c.contype = 'p'
  ),
  'Stripe event ID is the idempotency key'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'credit_wallets_pkey'
      and c.contype = 'p'
  ),
  'wallets have one row per owner'
);

select is(
  (
    select count(*)::integer
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'app'
      and t.relname = 'credit_wallets'
      and c.contype = 'f'
  ),
  0,
  'wallet owners intentionally have no auth-user foreign key'
);

select is(
  (
    select count(*)::integer
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'app'
      and t.relname = 'fdmd_saved_enrichments'
      and c.contype = 'f'
  ),
  0,
  'saved-artifact owners intentionally have no auth-user foreign key'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'auth_users_email_key'
      and c.contype = 'u'
  ),
  'Better Auth emails remain unique'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'auth_sessions_token_key'
      and c.contype = 'u'
  ),
  'Better Auth session tokens remain unique'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'auth_sessions_user_id_fkey'
      and c.confdeltype = 'c'
  ),
  'deleting a user cascades to sessions'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'auth_accounts_user_id_fkey'
      and c.confdeltype = 'c'
  ),
  'deleting a user cascades to provider accounts'
);

select is(
  (
    select array_length(c.conkey, 1)
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'fdmd_metric_counters_pkey'
      and c.contype = 'p'
  ),
  2,
  'metric counters retain the composite primary key'
);

select * from finish();
rollback;
