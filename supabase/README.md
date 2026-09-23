# Supabase database

The SQL files in `migrations/` are the canonical target schema for the
SQLite-to-Postgres migration. The application adapter uses this schema and
never creates tables at runtime.

## Design

- Application tables live in the non-exposed `app` schema.
- Supabase `anon` and `authenticated` roles have no access to that schema.
- Row-level security is deliberately deferred in this parity phase: the
  `app` schema is not exposed through the Data API, and the application will
  connect through a server-only database role. Enable RLS before exposing the
  schema or moving authorization into Supabase Auth.
- `free_design_app` is a `NOLOGIN` privilege role for the future Railway
  runtime login. A password-bearing login role must be provisioned separately;
  credentials must never be committed to a migration.
- Better Auth remains the identity provider.
- Application content timestamps and JSON remain text for first-pass parity.
- Better Auth dates use Postgres timestamps and booleans use native booleans.

## Local validation

```bash
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm db:stop
```

## Remote application

Apply each migration with Supabase MCP `apply_migration`, using the filename's
description as the migration name. After application:

1. List migrations and `app` tables.
2. Run the schema verification query in `tests/schema.test.sql` through the
   local test runner.
3. Run Supabase security and performance advisors.
4. Generate TypeScript types as an independent schema review artifact.

The data-transfer and rollback procedure is documented in
`docs/sqlite-to-supabase-runbook.md`.
