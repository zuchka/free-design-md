# Railway Supabase preview

## Created infrastructure

- Railway project: `freedesign.md`
- Environment: `supabase-preview`
- Environment ID: `6c9317d3-b475-4641-aa80-b29b3bec9608`
- Service: `free-design-md-supabase-preview`
- Service ID: `aa995408-280d-4a8a-8c48-a7ac3af6f6c9`
- Supabase project: `free-design-md-migration-demo`
- Supabase project ref: `eigswwtmuptcizadsctd`
- Region: Railway `us-west2`, Supabase `us-west-1`

The Railway environment was created empty. Production services, variables,
credentials, domains, and the SQLite volume were deliberately not copied.

## Preview image

The Docker release workflow publishes non-main manual builds as:

```text
ghcr.io/zuchka/free-design-md:supabase-preview
```

It also publishes an immutable `sha-<commit>` tag. Production continues to use
`latest`; a preview workflow dispatch cannot overwrite that tag.

The image built from commit `1d34df18152a73c44d059b8c141981734a47d734`
and was verified as a multi-architecture OCI image at digest:

```text
sha256:13e71f39991c3118ab1b14f8f386bb8e0efb7f3b0050f722f350d1e16a207e92
```

The Railway service is staged with this image and the `/api/health` deployment
healthcheck. It has not been deployed yet.

## Hosted import rehearsal

A dedicated `free_design_preview` login inherits only the `free_design_app`
group role. The synthetic SQLite fixture was imported through the Supavisor
session pooler using that login, exercising the same connection path as the
Railway service.

- 18 rows imported across all 13 application tables.
- Every table count and canonical digest matched the SQLite fixture.
- Owner distributions matched for all tenant-owned tables.
- All referential, wallet, ledger, checkout, and public-ID integrity checks
  passed.
- Reports are kept under the ignored `.migration-artifacts/demo/` directory so
  connection metadata and rehearsal artifacts cannot be committed.

## Required preview variables

Set these only in `supabase-preview`:

```text
DATABASE_URL
DATABASE_POOL_SIZE=5
BETTER_AUTH_SECRET
BETTER_AUTH_URL
PUBLIC_ORIGIN
```

Add `ANTHROPIC_API_KEY`, Resend, and Stripe test-mode variables only when those
flows are part of the rehearsal. Never copy the production Stripe webhook
secret or attach the production SQLite volume.

The database URL should use a dedicated password-bearing login that inherits
the `free_design_app` group role. Do not use an administrative connection in
the application.

## Deployment gate

The preview is ready for traffic only when all checks pass:

1. `GET /api/health` returns `200` with `{"ok":true,"database":"ready"}`.
2. Railway logs contain no database connection churn or authentication errors.
3. Supabase shows a small, stable session-pooler connection count.
4. A synthetic imported account restores its session.
5. An imported public artifact loads by its existing ID.
6. Owner-scoped create, list, and delete operations pass.
7. Credit reserve, commit, and refund pass.
8. A service restart preserves all reads and writes without a volume.

The non-sensitive Railway variables are staged. `DATABASE_URL` and
`BETTER_AUTH_SECRET` remain intentionally pending until those credentials can
be transferred into Railway with explicit operator confirmation. Public origin
variables and the Railway domain are set after the first healthy deployment.
