-- Create the private application namespace and least-privilege group role.
--
-- The Railway runtime login will be created separately and granted membership
-- in free_design_app. Password-bearing roles must never be stored in source.

create schema if not exists app;

comment on schema app is
  'Private Free design.md application data. Not exposed through the Supabase Data API.';

revoke all on schema app from public;
revoke all on schema app from anon;
revoke all on schema app from authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'free_design_app'
  ) then
    create role free_design_app nologin;
  end if;
end
$$;

grant usage on schema app to free_design_app;

-- Keep future objects private from API roles even if project-level defaults
-- change. Grant ordinary data access to the dedicated runtime group role.
alter default privileges for role postgres in schema app
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema app
  grant select, insert, update, delete on tables to free_design_app;

alter default privileges for role postgres in schema app
  revoke all on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema app
  grant usage, select on sequences to free_design_app;
