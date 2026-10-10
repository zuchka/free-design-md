# Production SQLite to Supabase cutover record

## Outcome

Production was cut over successfully from the Railway SQLite database to
Supabase Postgres on September 23, 2026. The application is live at
`https://freedesign.md`, writes are enabled, and the final health check
reports `database: ready`.

The first accepted Postgres production write was
`2026-09-23T19:00:18Z`. The rollback procedure must therefore use the
post-write reconciliation path in `docs/rollback-plan.md`.

## Systems and immutable artifacts

- Railway project: `freedesign.md`
- Railway project ID: `15934667-afad-41c1-8ac3-3078d527835a`
- Railway environment: `production`
- Railway service ID: `9501f615-c533-45f4-9467-c7f15c9a5409`
- Retained volume ID: `0cc8f29e-691a-4705-a692-058f3e140b42`
- Retained volume mount: `/app/data`
- Supabase project: `free-design-md-migration-demo`
- Supabase project ref: `eigswwtmuptcizadsctd`
- Supabase region: `us-west-1`
- Production commit: `0b8bd45c6551228c7e6356ffe5994605e946b505`
- Production image: `ghcr.io/zuchka/free-design-md:sha-0b8bd45`
- Maintenance commit: `525dc8f0a76df2c646afbe7db5dbf33bce4e8310`
- Maintenance image: `ghcr.io/zuchka/free-design-md:sha-525dc8f`

Final production deployment after removing the one-time snapshot token:
`ea62513d-14a6-41e6-a2cc-a0affe60e36a`.

## Source snapshot

The live SQLite service was put into application-enforced write maintenance.
Health and pages remained available; auth POSTs and the write-capable
`GET /api/extract` endpoint returned retryable `503` responses.

- Downloaded snapshot size: 36,446,208 bytes
- Downloaded snapshot SHA-256:
  `076b04022e67942620407337dcef78c410f5d96f88b29ae8d45ec145382ae1e9`
- Verified backup SHA-256:
  `da5182173e2b393a14262aa8396cab50fc13420a51996a94d20a46572404920f`
- SQLite integrity check: `ok`
- SQLite foreign-key errors: `0`
- Encrypted-channel checksum comparison: matched

Source row counts:

| Table | Rows |
| --- | ---: |
| `auth_users` | 83 |
| `auth_sessions` | 82 |
| `auth_accounts` | 0 |
| `auth_verifications` | 0 |
| `enrichment_cache` | 2 |
| `fdmd_iterations` | 12 |
| `fdmd_saved_enrichments` | 30 |
| `fdmd_metric_counters` | 36 |
| `credit_wallets` | 2 |
| `credit_ledger` | 6 |
| `credit_operations` | 5 |
| `purchases` | 4 |
| `stripe_events` | 1 |
| **Total** | **263** |

The private artifacts and machine-readable reports are retained under
`.migration-artifacts/production/2026-09-23T18-48Z/` and are excluded from
Git.

## Import and verification

The 18-row preview fixture was removed from the approved target after the final
production snapshot passed integrity checks. The importer then:

1. confirmed all 13 target tables were empty;
2. completed a 263-row dry run;
3. inserted all tables in dependency order in one transaction;
4. independently re-read SQLite and Postgres;
5. verified counts, order-independent row digests, owner distributions, public
   IDs, referential integrity, wallet/ledger consistency, and payment
   idempotency.

The first verification run exposed a verifier defect: it relied on each
database's collation order for mixed-case IDs. No data was changed. The digest
was made order-independent, regression tests were added, and the independent
verification then passed every line.

The controlled database integration suite passed 8 tests across auth,
multi-tenant saved content, concurrent credit reservation, commit/refund, and
Stripe idempotency. The unit suite passed 332 tests across 41 files. Typecheck
and production build also passed.

## Runtime security

The application connects as `free_design_production`, which inherits the
DML-only `free_design_app` group. The runtime check confirmed:

- membership in `free_design_app`;
- schema usage;
- table select and insert;
- no schema-create privilege;
- DDL denied with Postgres insufficient-privilege error;
- no superuser, create-role, create-database, replication, or bypass-RLS
  capability.

The Supabase security advisor returned no findings. The performance advisor
reported five informational unused-index findings, expected immediately after
creating and importing a new schema; the indexes support known auth and content
query paths and were retained.

The table inventory also emits a generic RLS-disabled warning. The tables are
in the private `app` schema, which is not exposed through the Data API, and
`public`, `anon`, and `authenticated` privileges are revoked. Enabling
RLS without a Supabase JWT identity model would block this server-only
application, so no automatic RLS change was made.

## Production validation

- Paused Postgres deployment:
  `9edd314a-2466-473f-979f-0e692039f685`
- Write-enabled deployment:
  `1525b51b-3f9b-403f-8912-dc5c48db4cf8`
- Persistence-check restart:
  `5ed32eb3-a3f4-4b89-b068-a740dc46b7b4`
- Final token-removal deployment:
  `ea62513d-14a6-41e6-a2cc-a0affe60e36a`

Validated behavior:

- `GET /api/health`: `200`, `database: ready`
- imported public artifact: `200`
- paused auth and extractor requests: `503`
- write-enabled anonymous auth: `200`
- imported session resolution: verified by data digest and database integration
  test
- controlled auth/session creation and resolution: `200`
- write-enabled extraction: `200`
- metrics write reached Postgres and persisted across restart
- restricted-role credit reserve, commit, refund, concurrency, and idempotency:
  passed
- final maintenance snapshot route: `404`
- one-time `MIGRATION_SNAPSHOT_TOKEN`: removed from Railway
- Railway runtime logs: no application errors
- Supabase Postgres error log query: no errors during cutover

Two temporary anonymous users created by cutover probes were deleted from
Postgres after validation. Final auth counts are therefore one lower than the
snapshot because the first probe occurred on SQLite before the write pause and
was included in the snapshot. All other business-data row counts remain
unchanged; the operational metrics digest changed as expected after the first
production request.

## Retention and rollback

The Railway volume remains attached at `/app/data` and was not modified,
detached, or deleted. Both final SQLite snapshot copies are retained locally.
Because Postgres accepted production writes, rollback requires explicit
reconciliation; switching the connection string back to SQLite without that
step would lose post-cutover changes.
