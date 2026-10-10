# SQLite to Postgres rollback plan

## Rollback boundary

The simple rollback is valid only while:

- the final SQLite volume and snapshot remain unchanged; and
- Postgres has accepted no production writes.

Record the timestamp of the first accepted Postgres write. After that point,
switching the connection back to SQLite would lose sessions, purchases, saved
artifacts, metrics, or wallet operations.

## Before Postgres accepts writes

1. Keep `MIGRATION_WRITE_PAUSED=1`.
2. Restore the previous immutable Railway image.
3. Restore the SQLite runtime configuration and volume mount.
4. Confirm the SQLite file checksum matches the final snapshot.
5. Verify health, auth reads, one public artifact, and wallet reads.
6. Clear the write pause only after those checks pass.
7. Preserve the failed Postgres database and reports for diagnosis.

## After Postgres accepts writes

1. Re-enable `MIGRATION_WRITE_PAUSED=1` immediately.
2. Record the affected time range and deployment IDs.
3. Export every Postgres row created or changed since cutover.
4. Reconcile auth, content, purchase, wallet, ledger, operation, Stripe-event,
   and metrics changes explicitly.
5. Decide whether to repair forward on Postgres or perform a reviewed reverse
   migration into a new SQLite copy.
6. Verify the reconciled database with application acceptance tests before
   reopening writes.

Never overwrite the final SQLite snapshot, truncate Postgres to hide a failed
cutover, or detach the Railway volume during incident response.

## Retention

Volume retirement requires a separate approval after the monitoring and data
retention period. Before retirement, confirm backups, legal or billing retention
needs, and a tested Postgres restore procedure.
