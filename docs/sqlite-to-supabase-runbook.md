# SQLite to Supabase Postgres runbook

This runbook covers the one-time data move from the Railway SQLite volume to
the private `app` schema in Supabase. It does not migrate identity to Supabase
Auth: Better Auth remains the identity provider.

## Safety rules

- Keep the source volume read-only during rehearsal.
- Never commit a database snapshot or migration report containing row values.
- Take the final snapshot only after application writes are paused.
- Import only into an empty target. The importer deliberately has no overwrite,
  truncate, or upsert mode.
- Keep the Railway volume intact through the rollback window.
- Use a direct Supabase connection when Railway supports IPv6; otherwise use
  the session pooler on port 5432. The transaction pooler on port 6543 is
  supported by the runtime client, but is not preferred for the migration.

## 1. Prepare and validate the target schema

```bash
nvm use
pnpm install
pnpm db:start
pnpm db:reset
pnpm db:test
```

For the hosted project, apply `supabase/migrations/` in filename order. Create
a password-bearing Railway login separately and grant it membership in the
`free_design_app` group role; never store that password in a migration or the
repository. The runtime login needs no access to `public`, `auth`, or Storage.

Run the Supabase security and performance advisors after applying the hosted
migrations. The `app` schema must remain absent from the Data API's exposed
schema list.

## 2. Capture a consistent SQLite snapshot

Locate the live file on the mounted Railway volume (currently
`/app/data/app.db`). Run the snapshot command in a trusted one-off environment
that has the repository tooling and the volume attached, or first copy the
SQLite file to an operator machine using the team's approved Railway volume
export procedure.

```bash
pnpm db:snapshot -- \
  --source /app/data/app.db \
  --output /secure-transfer/free-design-md.sqlite-snapshot.db \
  --report /secure-transfer/snapshot-report.json
```

The tool uses SQLite's online backup API, runs `integrity_check`, sets the
snapshot to owner-only permissions, and reports only file metadata, a SHA-256
checksum, and table counts. It never prints row values.

Transfer the snapshot over an encrypted channel. Confirm the SHA-256 digest on
the receiving machine before proceeding.

## 3. Dry-run the import

Set `DATABASE_URL` to a server-only Supabase connection or pass `--target`.
Avoid putting the URL in shell history when it includes a password.

```bash
DATABASE_URL='postgresql://...' pnpm db:migrate:sqlite -- \
  --source /secure-transfer/free-design-md.sqlite-snapshot.db \
  --dry-run \
  --report .migration-artifacts/dry-run.json
```

The dry-run verifies SQLite integrity and the 13-table allowlist, confirms that
every target table exists, refuses a nonempty target, and reports planned row
counts. Resolve every error before the cutover window.

## 4. Import and verify

```bash
DATABASE_URL='postgresql://...' pnpm db:migrate:sqlite -- \
  --source /secure-transfer/free-design-md.sqlite-snapshot.db \
  --batch-size 250 \
  --report .migration-artifacts/import-report.json
```

All inserts run in one short-lived Postgres transaction and in dependency
order. The importer converts SQLite integer booleans to Postgres booleans and
Better Auth epoch timestamps to `timestamp without time zone`; application JSON
and text timestamps are preserved byte-for-byte.

The command automatically verifies:

- all required tables and indexes;
- row counts and canonical SHA-256 row digests for every table;
- owner distributions without writing owner IDs to the report;
- Better Auth session/account foreign keys;
- saved-artifact parent/root references and public IDs;
- nonnegative wallets, wallet-versus-ledger totals, and billing uniqueness.

Run verification independently as a second check:

```bash
DATABASE_URL='postgresql://...' pnpm db:verify:sqlite -- \
  --source /secure-transfer/free-design-md.sqlite-snapshot.db \
  --report .migration-artifacts/verification-report.json
```

`passed` must be `true`. Retain the reports as private deployment artifacts;
they contain hashes and counts, not row contents.

## 5. Application acceptance

Against the imported database:

```bash
DATABASE_URL='postgresql://...' pnpm test:db
pnpm typecheck
pnpm test
pnpm build
```

The database suite exercises anonymous Better Auth sessions, saved-artifact
owner isolation, duplicate Stripe events and Checkout Sessions, idempotent
reserve/commit/refund behavior, and concurrent spends that must never make a
wallet negative.

Smoke-test the deployed candidate with a nonproduction account:

1. Create and restore an anonymous session.
2. Link a verified email through a magic link.
3. Read an existing public `/d/:id` artifact from the migration report's
   verified ID set (do not paste the ID into public logs).
4. List, save, and delete an owned enrichment; verify another account cannot
   list or delete it.
5. Complete one test-mode Stripe Checkout and replay the webhook; confirm the
   wallet is credited once.
6. Reserve and commit one AI run, then exercise a failed run and verify its
   reservation is refunded.

## 6. Final cutover

1. Announce the write pause and stop the Railway service or enable maintenance
   mode so no SQLite writes can occur.
2. Capture a new final snapshot; do not reuse a rehearsal snapshot.
3. Reset only the designated empty production target if explicitly approved.
4. Dry-run, import, verify, and run the acceptance suite.
5. Set Railway `DATABASE_URL` and optional `DATABASE_POOL_SIZE=5`. Remove
   `DATABASE_AUTH_TOKEN`; it belonged to libSQL.
6. Deploy the Postgres build and check `/api/health`, authentication, one public
   artifact, metrics writes, and Stripe test-mode fulfillment.
7. Record the snapshot checksum, migration commit, deployment ID, start/end
   times, and verification report location.

## Rollback

Rollback is valid only while the old SQLite volume is preserved and no new
production writes have been accepted by Postgres.

If verification fails before traffic resumes, leave the Postgres target
offline, restore the prior Railway deployment and SQLite `DATABASE_URL`
configuration, and restart against the untouched volume.

If Postgres has accepted new writes, do not silently switch back: that would
lose purchases, sessions, or saved artifacts. Re-enable maintenance mode,
export the new Postgres writes, reconcile them explicitly, and make a new
cutover decision. This migration intentionally does not implement dual-write.
