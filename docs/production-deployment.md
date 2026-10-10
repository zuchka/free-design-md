# Production deployment

## Canonical source

`main` contains the Supabase Postgres runtime and the complete production
history. PRs #65 (Stripe fulfillment) and #68 (paid-credit metrics) originally
targeted `codex/supabase-postgres-migration`; that branch was deployed without
being merged into `main`. PRs #66 (demo previews) and #67 (extraction diagnostics)
then landed on the older SQLite main branch, which left production and main
diverged. The October 2026 reconciliation brings both histories together.

Target subsequent feature PRs at `main`. The migration branch and cutover
documents are historical records, not an alternative release branch.

## Validation

The release workflow checks types, unit tests, Postgres integration tests, and
the application build on PRs. Its Postgres database is isolated and disposable.
Image publication on main runs only after these checks pass. Local integration
tests must likewise use a local database whose name ends in `_test` with the
repository migrations applied.

## Deployment and verification

Railway production should follow the GitHub repository's `main` branch, build
the repository Dockerfile, and wait for GitHub CI before deploying. Keep its
existing secrets, domains, and database connection. `/api/health` verifies the
Postgres schema and runtime grants before a deployment receives traffic.

After every release:

1. Confirm Railway's successful deployment matches the main commit.
2. Check `/api/health` returns `database: ready`.
3. Check `/api/metrics` reports both persistent and billing metrics available.
4. Verify `/examples` loads all 77 brand marks and a dark example preview is
   readable. Check a public saved artifact still loads.

The Docker workflow also publishes `ghcr.io/zuchka/free-design-md:latest` and
immutable `sha-<commit>` images for self-hosting and explicit image rollbacks.
Publishing an image does not update a Railway service pinned to another tag.

## Database safety and rollback

This release uses the existing production Postgres database. It does not rerun
the SQLite import or apply new schema changes. Startup never runs DDL.

Use Railway's previous successful Postgres deployment for application rollback.
Do not deploy a pre-migration SQLite build against the live database or switch
back to the old volume: Postgres has accepted production writes since cutover.
