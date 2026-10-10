---
name: sqlite-to-supabase-postgres
description: Safely migrate a SQLite-backed application to Supabase Postgres when data parity, authentication continuity, financial invariants, preview deployment, and rollback readiness matter. Use for real application migrations or production-shaped rehearsals, not ordinary greenfield Supabase schema design.
---

# SQLite to Supabase Postgres

Treat the running SQLite database and application queries as evidence. ORM
declarations may be stale. Preserve current behavior before improving the data
model.

## Establish the migration contract

Before changing code:

1. Inventory the actual SQLite tables, columns, constraints, indexes, and row
   counts.
2. Trace application reads and writes, especially authentication, ownership,
   billing, and idempotency paths.
3. Classify every source table as migrate, archive, or intentionally omit.
4. Record the behaviors that must survive: sessions, public identifiers,
   tenant boundaries, balances, and externally keyed operations.
5. Confirm the target Supabase project and environment. Do not infer that a
   reachable project is disposable.

Stop and ask before resetting a nonempty hosted target, changing production
credentials, or beginning a write outage.

## Build a reproducible target

- Use versioned SQL migrations that build an empty project deterministically.
- Keep application tables in a private schema unless the application needs the
  Data API.
- Separate the migration owner from the runtime login. Give the runtime only
  required schema usage, table DML, and sequence access.
- Do not store passwords or connection URLs in migrations, fixtures, reports,
  logs, or Git.
- Map types conservatively. Preserve text and JSON byte-for-byte unless the
  migration explicitly validates and adopts a new representation.
- Preserve source IDs and externally referenced uniqueness constraints.
- Remove runtime DDL before deploying the Postgres application.

Use Supabase migration tools for DDL. Inspect the resulting tables, migration
history, privileges, security findings, and performance findings after applying
the migrations.

## Transfer data safely

Take a consistent SQLite backup, never a raw copy of a live WAL database. The
importer must:

- use an explicit table and column allowlist;
- refuse a nonempty target by default;
- convert booleans and timestamp representations explicitly;
- insert in dependency order inside a transaction;
- avoid upsert, truncate, and overwrite modes for the first migration;
- write reports containing counts and hashes, not row values.

For the concrete verification gates, read
[references/verification.md](references/verification.md).

## Prove application parity

Run schema tests, application tests, and production-shaped acceptance tests.
Positive tests must prove legitimate workflows still work. Negative tests must
prove owners cannot access each other's rows and financial operations cannot be
replayed or overspent.

Deploy a preview with a nonproduction database and credentials. Restart it and
repeat the critical reads so success does not depend on the SQLite volume.

## Cut over and roll back

Do not cut production traffic over until a recent snapshot completes the full
rehearsal. Read [references/cutover.md](references/cutover.md) immediately before
a production rehearsal, preview deployment, or cutover.

Keep the final SQLite snapshot and volume untouched through the rollback
window. If Postgres has accepted writes, switching back without reconciliation
would lose data and is not a valid rollback.

## Report evidence

Report:

- migration versions and target identity;
- snapshot checksum and per-table counts;
- row-digest, ownership, auth, and billing results;
- preview deployment and smoke-test results;
- unresolved advisor findings and their disposition;
- the exact rollback boundary.

Do not claim the skill improves outcomes without repeated trials against the
same fixture, prompt, model, tools, timeout, and hidden evaluation suite.
