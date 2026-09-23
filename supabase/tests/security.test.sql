begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select ok(
  not has_schema_privilege('public', 'app', 'usage'),
  'PUBLIC cannot use the app schema'
);

select ok(
  not has_schema_privilege('anon', 'app', 'usage'),
  'Supabase anon cannot use the app schema'
);

select ok(
  not has_schema_privilege('authenticated', 'app', 'usage'),
  'Supabase authenticated cannot use the app schema'
);

select ok(
  not has_table_privilege('anon', 'app.auth_users', 'select'),
  'Supabase anon cannot read Better Auth users'
);

select ok(
  not has_table_privilege('authenticated', 'app.fdmd_saved_enrichments', 'select'),
  'Supabase authenticated cannot read saved artifacts directly'
);

select ok(
  not has_table_privilege('authenticated', 'app.credit_wallets', 'update'),
  'Supabase authenticated cannot update wallets directly'
);

select ok(
  has_schema_privilege('free_design_app', 'app', 'usage'),
  'runtime group can use the app schema'
);

select ok(
  not has_schema_privilege('free_design_app', 'app', 'create'),
  'runtime group cannot create schema objects'
);

select ok(
  has_table_privilege('free_design_app', 'app.auth_users', 'select'),
  'runtime group can read application tables'
);

select ok(
  has_table_privilege('free_design_app', 'app.fdmd_saved_enrichments', 'insert'),
  'runtime group can insert saved artifacts'
);

select ok(
  has_table_privilege('free_design_app', 'app.credit_wallets', 'update'),
  'runtime group can update wallets'
);

select ok(
  not (select rolcanlogin from pg_roles where rolname = 'free_design_app'),
  'runtime privilege role cannot log in without a separately provisioned login'
);

select * from finish();
rollback;
