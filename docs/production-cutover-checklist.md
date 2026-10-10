# Production cutover checklist

Production cutover is optional and remains blocked until every preview gate is
green. Record the operator, timestamp, commit, Railway deployment ID, Supabase
project ref, and artifact locations in the private change record.

## Go or no-go

- [ ] The final production-shaped rehearsal used a recent encrypted snapshot.
- [ ] The preview completed auth, ownership, public-link, billing, and restart
      checks.
- [ ] The migration commit is immutable and its Docker SHA tag exists.
- [ ] The Supabase target is approved and empty.
- [ ] All versioned migrations are applied.
- [ ] The security advisor has no unexplained findings.
- [ ] Performance advisor findings have a written disposition.
- [ ] A restricted runtime login exists and can perform DML but not DDL.
- [ ] The final SQLite snapshot destination and rollback owner are ready.
- [ ] The write-maintenance window is approved.

Any unchecked item is a no-go.

## Write pause and snapshot

- [ ] Set `MIGRATION_WRITE_PAUSED=1` and deploy while still using SQLite.
- [ ] Confirm POST, PUT, PATCH, and DELETE requests return retryable `503`.
- [ ] Confirm health and required read-only pages still respond.
- [ ] Confirm no active enrichment, purchase, auth, or webhook write is running.
- [ ] Take a SQLite online backup from `/app/data/app.db`.
- [ ] Run SQLite integrity and foreign-key checks.
- [ ] Record file size, per-table counts, and SHA-256.
- [ ] Copy the snapshot through an encrypted channel and confirm its checksum.

## Target import

- [ ] Confirm the connection points at the approved Supabase project.
- [ ] Confirm all 13 target tables contain zero rows.
- [ ] Run importer dry-run and retain its private report.
- [ ] Run the transactional import exactly once.
- [ ] Run the independent verifier.
- [ ] Confirm every scoreboard line passes.
- [ ] Run database integration, unit, typecheck, and build checks.

## Deploy Postgres

- [ ] Set the restricted `DATABASE_URL` and `DATABASE_POOL_SIZE=5` in Railway.
- [ ] Remove any legacy `DATABASE_AUTH_TOKEN`.
- [ ] Deploy the immutable Postgres image while writes remain paused.
- [ ] Confirm `/api/health` reports `database: ready`.
- [ ] Confirm one imported session, public artifact, and owned artifact.
- [ ] Confirm one credit reserve, commit, and refund using a controlled account.
- [ ] Confirm logs and Supabase connection counts are stable.
- [ ] Set `MIGRATION_WRITE_PAUSED=0` and deploy.
- [ ] Confirm new auth, content, and billing writes reach Postgres.

## Initial monitoring window

- [ ] Monitor health failures, auth errors, database timeouts, and latency.
- [ ] Monitor wallet operations and Stripe idempotency.
- [ ] Keep the final SQLite snapshot and Railway volume untouched.
- [ ] Record the moment Postgres accepts its first production write. That moment
      changes the rollback procedure.

Do not detach or delete the Railway volume during this checklist.
