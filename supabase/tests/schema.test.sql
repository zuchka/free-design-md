begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(22);

select ok(
  exists (select 1 from pg_namespace where nspname = 'app'),
  'app schema exists'
);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'app'
      and table_type = 'BASE TABLE'
  ),
  13,
  'app schema has exactly the 13 active runtime tables'
);

select ok(to_regclass('app.enrichment_cache') is not null, 'enrichment_cache exists');
select ok(to_regclass('app.fdmd_iterations') is not null, 'fdmd_iterations exists');
select ok(to_regclass('app.fdmd_saved_enrichments') is not null, 'fdmd_saved_enrichments exists');
select ok(to_regclass('app.fdmd_metric_counters') is not null, 'fdmd_metric_counters exists');
select ok(to_regclass('app.auth_users') is not null, 'auth_users exists');
select ok(to_regclass('app.auth_sessions') is not null, 'auth_sessions exists');
select ok(to_regclass('app.auth_accounts') is not null, 'auth_accounts exists');
select ok(to_regclass('app.auth_verifications') is not null, 'auth_verifications exists');
select ok(to_regclass('app.credit_wallets') is not null, 'credit_wallets exists');
select ok(to_regclass('app.credit_ledger') is not null, 'credit_ledger exists');
select ok(to_regclass('app.credit_operations') is not null, 'credit_operations exists');
select ok(to_regclass('app.purchases') is not null, 'purchases exists');
select ok(to_regclass('app.stripe_events') is not null, 'stripe_events exists');

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'app'
      and indexname = any (array[
        'fdmd_iter_session_created_idx',
        'fdmd_iter_owner_created_idx',
        'fdmd_saved_enrichments_owner_created_idx',
        'fdmd_saved_enrichments_source_url_idx',
        'fdmd_saved_enrichments_parent_idx',
        'fdmd_saved_enrichments_root_created_idx',
        'auth_sessions_user_id_idx',
        'auth_accounts_user_id_idx',
        'auth_verifications_identifier_idx',
        'credit_ledger_owner_created_idx',
        'purchases_owner_created_idx'
      ])
  ),
  11,
  'all 11 explicit runtime indexes exist'
);

select is(
  (
    select data_type
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'auth_users'
      and column_name = 'email_verified'
  ),
  'boolean',
  'Better Auth booleans use native Postgres boolean'
);

select is(
  (
    select data_type
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'auth_sessions'
      and column_name = 'expires_at'
  ),
  'timestamp without time zone',
  'Better Auth dates use Postgres timestamps'
);

select is(
  (
    select data_type
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'fdmd_saved_enrichments'
      and column_name = 'usage_json'
  ),
  'text',
  'application JSON remains text for migration parity'
);

select is(
  (
    select count(*)::integer
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.contype = 'f'
  ),
  2,
  'only the two existing Better Auth foreign keys are introduced'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'app'
      and c.conname = 'credit_wallets_balance_check'
      and c.contype = 'c'
  ),
  'wallet non-negative balance check exists'
);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'app'
      and table_name = any (array[
        'decks',
        'deck_shares',
        'deck_versions',
        'design_systems',
        'design_system_shares',
        'deck_share_links',
        'slide_comments'
      ])
  ),
  0,
  'legacy Drizzle-only tables are not recreated'
);

select * from finish();
rollback;
