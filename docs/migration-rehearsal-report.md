# Local migration rehearsal report

Date: 2026-09-22 (America/Los_Angeles)

## Scope

The checked-in application schema was reset into the local Supabase Postgres
container. The repository's current `data/app.db` passed integrity checking but
contained zero rows in all 13 active tables, so an additional synthetic,
production-shaped SQLite snapshot was generated for meaningful coverage. It
contained two identities, a live session, account and verification records, a
two-level saved-artifact tree, successful and rejected iterations, cached
enrichment, metrics, two wallets, a purchase, two ledger entries, a committed
operation, and a Stripe event. All values were synthetic.

## Results

- Supabase migrations: passed.
- pgTAP schema/security/constraint suite: 46/46 passed.
- Snapshot integrity check: passed.
- Dry-run: target empty; 18 rows planned across 13 tables.
- Transactional import: 18 rows imported.
- Deterministic verification: all 13 row counts and canonical digests matched.
- Owner distributions: matched for every owner-scoped table.
- Orphan, negative-wallet, ledger-balance, and duplicate billing checks: zero.
- Public saved-artifact ID digest: matched.
- Postgres application acceptance: 8/8 passed.
- Database-independent application tests: 322/322 passed.
- TypeScript typecheck: passed.

The first verification run exposed a timezone interpretation difference in the
Postgres.js parser for `timestamp without time zone` when the operator machine
was in Pacific time. The stored Postgres wall-clock values were correct. The
verifier was corrected to canonicalize these fields as UTC wall-clock values,
and the independent verification then passed. Drizzle already installs its own
transparent timestamp parser before Better Auth reads these columns.

## Timing and artifacts

On the local fixture, reset plus dry-run took about 14 seconds; import and full
verification each completed in under one second. These timings are not a
production estimate because the fixture is small and the target is local.

Snapshots and JSON reports were written only to an owner-private temporary
directory outside the repository. No database rows, credentials, or generated
snapshot files were committed.

## Hosted readiness

The three checked-in migrations are applied to the hosted
`free-design-md-migration-demo` project. All 13 target tables are present and
empty, and the formal Supabase security advisor reports no findings. The
performance advisor reports only unused indexes, which is expected on an empty
rehearsal database.

The generic table inventory warns that RLS is disabled. This is an explicit
architecture decision: the tables live in the private `app` schema, access is
revoked from `public`, `anon`, and `authenticated`, and Better Auth uses a
restricted server login rather than Supabase JWT identities. RLS must not be
enabled blindly because it would lock out the application role without adding
the intended owner context.

The Railway `supabase-preview` environment now exists but has no service,
database credential, or copied production secrets. The production volume has
not been read or modified and production has not been redeployed. Complete the
preview deployment and a recent encrypted-snapshot rehearsal before using the
production checklist.
