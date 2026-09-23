# Preview and production cutover

## Preview gate

Use a separate environment, database, application secret, origin, and
nonproduction integrations. Do not attach or copy the production SQLite volume.

Verify the health endpoint checks the database rather than only the web
process. Inspect application logs, database connections, auth errors, and query
latency. Restart the service and rerun critical reads.

## Production cutover

1. Enable a write pause that covers application writes, authentication, and
   billing callbacks.
2. Create a final SQLite online backup and record its checksum.
3. Confirm the target is the approved empty database and all migrations exist.
4. Dry-run the importer, then import once.
5. Run the independent verifier and critical acceptance tests.
6. Deploy the Postgres configuration while keeping writes paused.
7. Reopen writes only after health, authentication, public reads, ownership,
   and billing checks pass.
8. Record deployment identity, timestamps, reports, and the rollback boundary.

## Rollback boundary

Before Postgres accepts writes, restore the previous deployment and SQLite
configuration if verification fails. After Postgres accepts writes, pause again
and reconcile the new Postgres records before any switch back. Never detach or
delete the source volume during the initial cutover.
