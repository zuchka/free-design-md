# Database schema inventory

This document records the authoritative SQLite schema before the Free design.md
database is moved to Supabase Postgres. It is intentionally based on a clean
database produced by `server/db/migrate.ts` and cross-checked against production
query paths. `server/db/schema.ts` is not authoritative because it contains
legacy declarations and omits an actively used table.

## Authority order

When sources disagree, use this order:

1. The deployed SQLite database after the startup migration completes.
2. `server/db/migrate.ts`.
3. SQL and Drizzle queries in production code.
4. `server/db/schema.ts`.

The Supabase migrations under `supabase/migrations/` are the canonical target
schema. Phase 3 must make the Postgres Drizzle schema match those migrations.

## Active runtime tables

The clean SQLite runtime creates 13 tables and 11 explicit non-constraint
indexes.

| Table                    | Purpose                                                      | Ownership or exposure                                                                                    | Important constraints and indexes                               | Target type notes                                                                               |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `enrichment_cache`       | URL and prompt-version cache for AI enrichment               | Shared server-side cache                                                                                 | Primary key on `cache_key`                                      | Preserve JSON and timestamps as text for parity                                                 |
| `fdmd_iterations`        | Server-side history for iterative edits                      | `owner` identifies the acting owner                                                                      | Indexes on `(session_id, created_at)` and `(owner, created_at)` | Present in runtime SQL but missing from Drizzle                                                 |
| `fdmd_saved_enrichments` | Durable saved design snapshots and public `/d/:id` artifacts | Lists and deletion are scoped by `owner_id`; reads by ID are intentionally public through the server API | Indexes on owner, source URL, parent, and root                  | Snapshot payloads remain text, not `jsonb`, for the first migration                             |
| `fdmd_metric_counters`   | Persistent labeled counters                                  | Internal operational data                                                                                | Composite primary key on `(name, label_key)`                    | Preserve labels JSON as text                                                                    |
| `auth_users`             | Better Auth users, including anonymous users                 | Managed by Better Auth                                                                                   | Primary key and unique email                                    | SQLite integer booleans become Postgres booleans; epoch dates become timestamps during transfer |
| `auth_sessions`          | Better Auth sessions                                         | Belongs to `auth_users`                                                                                  | Unique token, user index, cascading user foreign key            | Epoch dates become timestamps during transfer                                                   |
| `auth_accounts`          | Better Auth provider accounts                                | Belongs to `auth_users`                                                                                  | User index and cascading user foreign key                       | Epoch dates become timestamps during transfer                                                   |
| `auth_verifications`     | Better Auth magic-link verification state                    | Managed by Better Auth                                                                                   | Identifier index                                                | Existing nullable audit timestamps stay nullable                                                |
| `credit_wallets`         | Current purchased-credit balance                             | Scoped by `owner_id` in server code                                                                      | Primary key on owner; balance cannot be negative                | No user foreign key: synthetic and legacy owners must remain importable                         |
| `credit_ledger`          | Immutable credit movements                                   | Scoped by `owner_id` in server code                                                                      | Unique reference ID and owner/date index                        | Financial parity is validated separately from row counts                                        |
| `credit_operations`      | Reserve/commit/refund state machine                          | Scoped by `owner_id` in server code                                                                      | Primary key on operation ID                                     | Status remains unconstrained until all legacy values are inventoried                            |
| `purchases`              | Stripe checkout fulfillment state                            | Scoped by `owner_id` in server code                                                                      | Unique checkout session and owner/date index                    | Amount remains integer minor units                                                              |
| `stripe_events`          | Stripe webhook idempotency                                   | Internal billing data                                                                                    | Primary key on event ID                                         | Duplicate events must remain impossible                                                         |

## Explicit runtime indexes

The following indexes must exist in Postgres in addition to indexes created by
primary-key and unique constraints:

1. `fdmd_iter_session_created_idx`
2. `fdmd_iter_owner_created_idx`
3. `fdmd_saved_enrichments_owner_created_idx`
4. `fdmd_saved_enrichments_source_url_idx`
5. `fdmd_saved_enrichments_parent_idx`
6. `fdmd_saved_enrichments_root_created_idx`
7. `auth_sessions_user_id_idx`
8. `auth_accounts_user_id_idx`
9. `auth_verifications_identifier_idx`
10. `credit_ledger_owner_created_idx`
11. `purchases_owner_created_idx`

## Schema drift and dispositions

| Object                                                                                                  | Evidence                                                                                                   | Disposition                                                                             |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `decks`                                                                                                 | Declared in `server/db/schema.ts`; not created by runtime migration                                        | Exclude from the initial Postgres schema                                                |
| `deck_shares`                                                                                           | Declared only in the Drizzle schema                                                                        | Exclude                                                                                 |
| `deck_versions`                                                                                         | Declared only in the Drizzle schema                                                                        | Exclude                                                                                 |
| `design_systems`                                                                                        | Declared in Drizzle and read by the legacy `export-design-md` action, but absent from the runtime database | Exclude; phase 3 must remove or explicitly restore the stale action                     |
| `design_system_shares`                                                                                  | Declared only in the Drizzle schema                                                                        | Exclude                                                                                 |
| `deck_share_links`                                                                                      | Declared only in the Drizzle schema                                                                        | Exclude                                                                                 |
| `slide_comments`                                                                                        | Declared only in the Drizzle schema                                                                        | Exclude                                                                                 |
| `fdmd_iterations`                                                                                       | Created by runtime migration and written by the iteration route, but absent from Drizzle                   | Include                                                                                 |
| `fdmd_users`, `fdmd_sessions`, `fdmd_builder_keys`, `fdmd_quota`, `fdmd_credit_promos`, `fdmd_byo_keys` | Explicitly dropped by the current startup migration                                                        | Exclude per the product rule that legacy Builder identities and quotas are not migrated |

## Ownership model

The active application is multi-user rather than organization-tenant based.
Saved content and financial records use Better Auth user IDs or synthetic
anonymous owner IDs. The `org_id` columns in legacy Drizzle declarations are
not part of the active runtime schema.

The first Postgres migration preserves server-enforced ownership semantics. It
does not introduce Supabase Auth or `auth.uid()` policies. All application
tables live in a non-exposed `app` schema, and Supabase Data API roles receive
no schema or table privileges.

## Deliberately deferred hardening

These changes require production-data analysis and are therefore deferred to
the transfer or application-port phases:

- Converting application-owned text timestamps to `timestamptz`.
- Converting JSON strings to `jsonb`.
- Adding owner foreign keys to auth users.
- Adding status enums or checks to billing state columns.
- Introducing organization tenancy or database-enforced per-user RLS.
- Deleting the legacy Drizzle declarations from `server/db/schema.ts`.

Deferring these changes keeps the database-engine migration behavior-preserving
and prevents a schema cleanup from being confused with data migration.
